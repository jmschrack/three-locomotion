/*
Copyright (c) 2010, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/
//#define DEBUG
//#define VISUALIZE

import { AnimationAction, Clock, LoopRepeat, MathUtils, Matrix4, Object3D, Quaternion, Raycaster, Vector2, Vector3 } from "three";
import { LegController, LegInfo } from "./locomotion";
import { AlignmentTracker } from "./AlignmentTracker";
import { MotionType } from "./data";

import * as Util from "./util";
import { animationList } from "../src/signals";
import { GetAnklePosition, GetHeelOffset, MotionAnalyzer, MotionAnalyzerBackwards } from "./motionAnalyzerBackwards";
import { GhostOriginal } from "./GhostOriginal";
import { IK1JointAnalytic } from "./IK1JointAnalytic";
import { IKSimple } from "./IKSimple";

export const LegCyclePhase = {
    Stance: 0, Lift: 1, Flight: 2, Land: 3
}

class LegState {
    constructor() {

        // Past and future step
        this.stepFromPosition = new Vector3();
        this.stepToPosition = new Vector3();
        this.stepToPositionGoal = new Vector3();
        this.stepFromMatrix = new Matrix4();
        this.stepToMatrix = new Matrix4();
        this.stepFromTime = 0;
        this.stepToTime = 0;
        this.stepNr = 0;
        // Continiously changing foot state
        this.cycleTime = 1;
        this.designatedCycleTimePrev = 0.9;
        this.hipReference = new Vector3();
        this.ankleReference = new Vector3();
        this.footBase = new Vector3();
        this.footBaseRotation = new Quaternion();
        this.ankle = new Vector3();
        // Foot cycle event time stamps
        this.stanceTime = 0;
        this.liftTime = 0.1;
        this.liftoffTime = 0.2;
        this.postliftTime = 0.3;
        this.prelandTime = 0.7;
        this.strikeTime = 0.8;
        this.landTime = 0.9;
        this.phase = LegCyclePhase.Stance;
        // Standing logic
        this.parked = false;
        // Cycle properties
        this.stancePosition = new Vector3();
        this.heelToetipVector = new Vector3();
        this.debugHistory = [];

    }


    //public List<string> debugHistory = new List<string>();
    /**
     * 
     * @param {Number} time 
     * @returns 
     */
    GetFootGrounding(time) {
        if ((time <= this.liftTime) || (time >= this.landTime)) return 0;
        if ((time >= this.postliftTime) && (time <= this.prelandTime)) return 1;
        if (time < this.postliftTime) {
            return (time - this.liftTime) / (this.postliftTime - this.liftTime);
        }
        else {
            return 1 - (time - this.prelandTime) / (this.landTime - this.prelandTime);
        }
    }
}

class MotionGroupState {
    constructor() {
        this.controller = null;
        this.weight = 0;
        /**@type {AnimationAction[]} */
        this.motionStates = [];
        this.relativeWeights = [];
        this.relativeWeightsBlended = [];
        this.primaryMotionIndex = 0;

    }

}

/* [RequireComponent(typeof(LegController))]
[RequireComponent(typeof(AlignmentTracker))] */

export class LegAnimator {
    constructor(object, raycast,legC,tr) {
        /**@type {Object3D} */
        this.transform = object;
        /**@type {Function} */
        this.raycast = raycast;

        this.startAutomatically = true;
        this.useIK = true;
        this.maxFootRotationAngle = 45.0;
        this.maxIKAdjustmentDistance = 0.5;
        // Step behavior settings
        this.minStepDistance = 0.2;
        this.maxStepDuration = 1.5;
        this.maxStepRotation = 160;
        this.maxStepAcceleration = 5.0;
        this.maxStepHeight = 1.0;
        this.maxSlopeAngle = 60;
        // Transition behavior settings
        this.enableLegParking = true;
        this.blendSmoothing = 0.2;
        this.groundLayers = 1;
        // Tilting settings
        this.groundHugX = 0;
        this.groundHugZ = 0;
        this.climbTiltAmount = 0.5;
        this.climbTiltSensitivity = 0.0;
        this.accelerateTiltAmount = 0.02;
        this.accelerateTiltSensitivity = 0.0;
        // Debug settings
        this.renderFootMarkers = false;
        this.renderBlendingGraph = false;
        this.renderCycleGraph = false;
        this.renderAnimationStates = false;
        this.vertexColorMaterial = null;
        this.isActive = false;
        this.currentTime = 0;
        /** @type {LegController} */
        this.legC = legC;
        /** @type {AlignmentTracker} */
        this.tr = tr;
        /**@type {LegInfo[]} */
        this.legs = [];
        /**@type {LegState[]} */
        this.legStates = [];
        this.position = new Vector3();
        this.speed = 0;
        this.hSpeedSmoothed = 0;
        this.objectVelocity = new Vector3();
        this.usedObjectVelocity = new Vector3();
        this.rotation = new Quaternion();
        this.up = new Vector3();
        this.forward = new Vector3();
        this.scale = 0;
        this.baseUpGround = new Vector3();
        this.bodyUp = new Vector3();
        this.legsUp = new Vector3();
        this.accelerationTiltX = 0;
        this.accelerationTiltZ = 0;
        /**@type {AnimationAction} */
        this.controlMotionState = null;
        /**@type {MotionGroupState[]} */
        this.motionGroupStates = [];
        /**@type {AnimationAction[]} */
        this.nonGroupMotionStates = [];
        /**@type {number[]} */
        this.nonGroupMotionWeights = [];
        /**@type {AnimationAction[]} */
        this.motionStates = [];
        /**@type {AnimationAction[]} */
        this.cycleMotionStates = [];
        /**@type {number[]} */
        this.motionWeights = [];
        /**@type {number[]} */
        this.cycleMotionWeights = [];
        this.summedMotionWeight = 0;
        this.summedCycleMotionWeight = 0;
        this.locomotionWeight = 0;
        this.cycleDuration = 0;
        this.cycleDistance = 0;
        this.normalizedTime = 0;
        this.updateStates = true;
        this.trajectories = {};
        this.ghost = null;

    }

    /* public bool startAutomatically = true;
    public bool useIK = true;

    [Space]

    public const maxFootRotationAngle = 45.0f;
    public const maxIKAdjustmentDistance = 0.5f;
	
	
    public const minStepDistance = 0.2f; // Model dependent, thus no better default
    public const maxStepDuration = 1.5f; // Sensible for most models
    public const maxStepRotation = 160; // Sensible for most models, must be less than 180
    public const maxStepAcceleration = 5.0f; // Model dependent, thus no better default
    public const maxStepHeight   = 1.0f;
    public const maxSlopeAngle = 60; // Sensible for most models, must be less than 90
	
	
    public bool enableLegParking = true;
    public const blendSmoothing = 0.2f;
    public LayerMask groundLayers = 1; // Default layer per default
	
	
    public const groundHugX = 0; // Sensible for humanoids
    public const groundHugZ = 0; // Sensible for humanoids
    public const climbTiltAmount = 0.5f; // Sensible default value
    public const climbTiltSensitivity = 0.0f; // None as default
    public const accelerateTiltAmount = 0.02f; // Sensible default value
    public const accelerateTiltSensitivity = 0.0f; // None as default;

    [Header ("Debug")]

	
    public bool renderFootMarkers = false;
    public bool renderBlendingGraph = false;
    public bool renderCycleGraph = false;
    public bool renderAnimationStates = false;

    public Material vertexColorMaterial;
	
    private bool isActive;
    private const currentTime;
	
    private LegController legC;
    private AlignmentTracker tr;
    private LegInfo[] legs;
    private LegState[] legStates;
	
    private const position;
    private const speed;
    private const hSpeedSmoothed;
    private const objectVelocity;
    private const usedObjectVelocity;
    private Quaternion rotation;
    private const up;
    private const forward;
    private const scale;
    private const baseUpGround;
    private const bodyUp;
    private const legsUp;
    private const accelerationTiltX;
    private const accelerationTiltZ;
	
    private AnimationState controlMotionState;
    private MotionGroupState[] motionGroupStates;
    private AnimationState[] nonGroupMotionStates;
    private float[] nonGroupMotionWeights;
	
    private AnimationState[] motionStates;
    private AnimationState[] cycleMotionStates;
    private float[] motionWeights;
    private float[] cycleMotionWeights;
    private const summedMotionWeight;
    private const summedCycleMotionWeight;
    private const locomotionWeight;
	
    private const cycleDuration;
    private const cycleDistance;
    private const normalizedTime;
	
    private bool updateStates = true;
	
    [System.NonSerialized]
    public GameObject ghost;
	
    private Dictionary<string,TrajectoryVisualizer> trajectories
        = new Dictionary<string,TrajectoryVisualizer>();
	
    [Conditional("VISUALIZE")]
    void AddTrajectoryPoint(string name, const point) {
        trajectories[name].AddPoint(Time.time,point);
    }
	
    [Conditional("DEBUG")]
    void Assert(bool condition, string text) {
        if (!condition) UnityEngine.Debug.LogError(text);
    }
	
    [Conditional("DEBUG")]
    void AssertSane(const f, string text) {
        if (!Util.IsSaneNumber(f)) UnityEngine.Debug.LogError(text+"="+f);
    }
	
    [Conditional("DEBUG")]
    void AssertSane(const vect, string text) {
        if (!Util.IsSaneNumber(vect.x)
            || !Util.IsSaneNumber(vect.y)
            || !Util.IsSaneNumber(vect.z)
        ) UnityEngine.Debug.LogError(text+"="+vect);
    }
	
    [Conditional("DEBUG")]
    void AssertSane(Quaternion q, string text) {
        if (!Util.IsSaneNumber(q.x)
            || !Util.IsSaneNumber(q.y)
            || !Util.IsSaneNumber(q.z)
            || !Util.IsSaneNumber(q.w)
        ) UnityEngine.Debug.LogError(text+"="+q);
    } */

    Start() {
        //tr = GetComponent(typeof(AlignmentTracker)) as AlignmentTracker;
        //legC = GetComponent(typeof(LegController)) as LegController;
        this.legs = this.legC.legs;
        if (!this.legC.initialized) {
            console.error(`Locomotion System has not been initialized."`);
            this.enabled = false;
        }

        this.legStates = new Array(this.legs.length);//new LegState[legs.length];

        this.updateStates = true;
        this.ResetMotionStates();
        this.ResetSteps();

        this.isActive = false;

        /* for (let leg=0; leg<this.legs.length; leg++) {
            this.trajectories.Add(
                "leg"+leg+"heel",
                new TrajectoryVisualizer(this.legs[leg].debugColor, 3)
            );
            this.trajectories.Add(
                "leg"+leg+"toetip",
                new TrajectoryVisualizer(this.legs[leg].debugColor, 3)
            );
            this.trajectories.Add(
                "leg"+leg+"footbase",
                new TrajectoryVisualizer(this.legs[leg].debugColor, 3)
            );
        } */
    }

    OnEnable() {
        this.updateStates = true;
        if (this.legC == null) return;
        this.ResetMotionStates();
        this.ResetSteps();
        if (!this.legC.initialized) {
            console.error(": Locomotion System has not been initialized.", this);
            this.enabled = false;
        }
    }

    ResetMotionStates() {
        this.motionStates = new Array(this.legC.motions.length);//AnimationState[legC.motions.length];
        this.cycleMotionStates = new Array(this.legC.cycleMotions.length)//AnimationState[legC.cycleMotions.length];
        this.motionWeights = new Array(this.legC.motions.length);//float[legC.motions.length];
        this.cycleMotionWeights = new Array(this.legC.cycleMotions.length);//float[legC.cycleMotions.length];
        this.nonGroupMotionWeights = new Array(this.legC.m_NonGroupMotions.length);//float[legC.nonGroupMotions.length];

        // Create control motion state
        //this.controlMotionState = GetComponent<Animation>()["LocomotionSystem"];
        if (this.controlMotionState == null) {
            // Create dummy animation state with control motion name
            //throw new Error("NotImplementedException:: this.controlMotionState==null !!")
            this.controlMotionState = animationList.value.find(a => a.getClip().name == "idle")
            /* const clip = new AnimationAction();
            clip.legacy = true;
            GetComponent<Animation>().AddClip(clip, "LocomotionSystem");
            this.controlMotionState = GetComponent<Animation>()["LocomotionSystem"]; */
        }
        this.controlMotionState.enabled = true;
        this.controlMotionState.setLoop(LoopRepeat, -1)
        //this.controlMotionState.wrapMode = WrapMode.Loop;
        this.controlMotionState.weight = 1;
        //this.controlMotionState.layer = 10000;

        // Create motion states
        this.motionGroupStates = new Array(this.legC.motionGroups.length)//new MotionGroupState[this.legC.motionGroups.length];
        let cm = 0;
        for (let m = 0; m < this.legC.motions.length; m++) {
            this.motionStates[m] = null;//GetComponent<Animation>()[legC.motions[m].name];
            if (this.motionStates[m] == null) {
                //GetComponent<Animation>().AddClip(legC.motions[m].animation, legC.motions[m].name);
                this.motionStates[m] = animationList.value.find(a => a.getClip().name == this.legC.motions[m].name)//GetComponent<Animation>()[this.legC.motions[m].name];
            }
            //this.motionStates[m].wrapMode = WrapMode.Loop;
            if (this.legC.motions[m].motionType == MotionType.WalkCycle) {
                this.cycleMotionStates[cm] = this.motionStates[m];
                this.cycleMotionStates[cm].setEffectiveTimeScale(0);//.speed = 0;
                cm++;
            }
        }

        // Create motion group states
        for (let g = 0; g < this.motionGroupStates.length; g++) {
            const controller = {};//GetComponent<Animation>()[this.legC.motionGroups[g].name];
            if (controller == null) {
                // Create dummy animation state with motion group name
                /* const clip = new AnimationClip();
                clip.legacy = true;
                GetComponent<Animation>().AddClip(clip, this.legC.motionGroups[g].name);
                controller = GetComponent<Animation>()[this.legC.motionGroups[g].name]; */
                throw new Error("NotImplementedException:: controller==null !!")
            }
            controller.enabled = true;
            //controller.wrapMode = WrapMode.Loop;
            if (this.startAutomatically && g == 0) controller.weight = 1;

            // Create state for this motion group
            this.motionGroupStates[g] = new MotionGroupState();
            this.motionGroupStates[g].controller = controller;
            this.motionGroupStates[g].motionStates = new Array(this.legC.motionGroups[g].motions.length);//AnimationState[this.legC.motionGroups[g].motions.length];
            this.motionGroupStates[g].relativeWeights = new Array(this.legC.motionGroups[g].motions.length);//float[this.legC.motionGroups[g].motions.length];
            for (let m = 0; m < this.motionGroupStates[g].motionStates.length; m++) {
                this.motionGroupStates[g].motionStates[m] = animationList.value.find(a => a.getClip().name == this.legC.motionGroups[g].motions[m].name)

            }
            this.motionGroupStates[g].primaryMotionIndex = 0;
        }

        // Create list of motions states that are not in motions groups
        this.nonGroupMotionStates = new Array(this.legC.nonGroupMotions.length)//AnimationState[this.legC.nonGroupMotions.length];
        for (let m = 0; m < this.legC.nonGroupMotions.length; m++) {
            this.nonGroupMotionStates[m] = animationList.value.find(a => a.getClip().name == this.legC.nonGroupMotions[m].name);//GetComponent<Animation>()[this.legC.nonGroupMotions[m].name];
            if (this.nonGroupMotionStates[m] == null) {
                /* GetComponent<Animation>().AddClip(this.legC.nonGroupMotions[m].animation, this.legC.nonGroupMotions[m].name);
                this.nonGroupMotionStates[m] = GetComponent<Animation>()[this.legC.nonGroupMotions[m].name];
                this.nonGroupMotionWeights[m] = this.nonGroupMotionStates[m].weight; */
                throw new Error("NotImplementedException:: this.nonGroupMotionStates[m]==null !!")
            }
        }

        for (let leg = 0; leg < this.legs.length; leg++) {
            this.legStates[leg] = new LegState();
        }
    }

    ResetSteps(time) {
        //this.up = transform.up;
        //this.forward = transform.forward;
        this.baseUpGround = this.up;
        this.legsUp = this.up;
        this.accelerationTiltX = 0;
        this.accelerationTiltZ = 0;
        this.bodyUp = this.up;

        this.tr.Reset();

        for (let leg = 0; leg < this.legs.length; leg++) {
            this.legStates[leg].stepFromTime = time - 0.01;
            this.legStates[leg].stepToTime = time;

            this.legStates[leg].stepFromMatrix = this.FindGroundedBase(
                this.transform.localToWorld(this.legStates[leg].stancePosition.clone().divideScalar(this.scale)),
                this.transform.getWorldQuaternion(new Quaternion()),
                this.legStates[leg].heelToetipVector,
                false
            );
            this.legStates[leg].stepFromPosition = new Vector3(...this.legStates[leg].stepFromMatrix.elements.slice(12, 16));//TODO confirm this is correct  //.GetColumn(3);

            this.legStates[leg].stepToPosition = this.legStates[leg].stepFromPosition;
            this.legStates[leg].stepToMatrix = this.legStates[leg].stepFromMatrix;
        }
        this.normalizedTime = 0;

        this.cycleDuration = this.maxStepDuration;
        this.cycleDistance = 0;
    }

    Update({ deltaTime, timeScale = 1, time }) {

        if (deltaTime == 0 || timeScale == 0) return;

        this.scale = this.transform.getWorldScale(new Vector3()).z;// lossyScale.z;

        //AssertSane(this.tr.velocity,"tr.velocity");
        //AssertSane(this.up,"up");

        // When calculating speed, clamp vertical speed to be no longer than horizontal speed
        // to avoid sudden spikes when CharacterController walks up a step.
        const velocityVClamped = Util.ProjectOntoPlane(this.tr.velocity, this.up);
        this.speed = velocityVClamped.length();
        velocityVClamped.add(this.up.clone().multiplyScalar(Util.Clamp(this.tr.velocity.dot(this.up), -1 * this.speed, this.speed)));
        this.speed = velocityVClamped.length();

        this.hSpeedSmoothed = Util.ProjectOntoPlane(this.tr.velocitySmoothed, this.up).length();

        this.objectVelocity = this.transform.localToWorld(this.tr.velocitySmoothed.clone()).sub(this.transform.localToWorld(Util.zero()));

        // Check if velocity (and turning - not implemented yet) have changed significantly
        let newVelocity = false;
        if (
            this.objectVelocity.clone().sub(this.usedObjectVelocity).length()
            >
            0.002 * Math.min(this.objectVelocity.length(), this.usedObjectVelocity.length())
            ||
            this.updateStates
        ) {
            newVelocity = true;
            this.usedObjectVelocity = this.objectVelocity;
        }

        let newWeights = false;
        const smallWeightDifference = 0.001;

        // Handle weights in motions groups
        for (let g = 0; g < this.legC.motionGroups.length; g++) {
            const group = this.motionGroupStates[g];

            // Check if motion group weight have changed significantly
            let changedGroupWeight = false;
            let justEnabled = false;
            let newGroupWeight = group.controller.weight;
            //AssertSane(newGroupWeight,"newGroupWeight");
            if (group.controller.enabled == false || newGroupWeight < smallWeightDifference) newGroupWeight = 0;
            else if (newGroupWeight > 1 - smallWeightDifference) newGroupWeight = 1;
            if (Math.abs(newGroupWeight - group.weight) > smallWeightDifference) {
                changedGroupWeight = true;
                newWeights = true;
                if (group.weight == 0 && newGroupWeight > 0) justEnabled = true;
                group.weight = newGroupWeight;
            }

            // Check if primary weight in motion group have changed significantly
            // by external factors, for example a CrossFade that fades down these weights.
            // We must then enforce that the weights are again set according to the group dictate
            else if (
                Math.abs(
                    group.motionStates[group.primaryMotionIndex].weight
                    - group.relativeWeights[group.primaryMotionIndex] * group.weight
                ) > smallWeightDifference
                /* ||
                group.motionStates[group.primaryMotionIndex].layers
                != group.controller.layer */ //TODO figure out animation layers
            ) {
                changedGroupWeight = true;
            }

            if (newVelocity || changedGroupWeight) {

                // Update weights in motion group if necessary
                if ((newVelocity || justEnabled) && group.weight > 0) {
                    newWeights = true;

                    // Calculate motion weights - heavy call! :(
                    const groupInfo = this.legC.motionGroups[g];
                    group.relativeWeights = groupInfo.GetMotionWeights(new Vector3(this.objectVelocity.x, 0, this.objectVelocity.z));

                }
            }

            if (group.weight > 0) {
                if (group.relativeWeightsBlended == null) {
                    group.relativeWeightsBlended = new Array(group.relativeWeights.length);// float[group.relativeWeights.length];
                    for (let m = 0; m < group.motionStates.length; m++) {
                        group.relativeWeightsBlended[m] = group.relativeWeights[m];
                    }
                }

                let highestWeight = 0;
                const controllerLayer = group.controller.layer;
                for (let m = 0; m < group.motionStates.length; m++) {
                    if (this.blendSmoothing > 0)
                        group.relativeWeightsBlended[m] = MathUtils.lerp(group.relativeWeightsBlended[m], group.relativeWeights[m], deltaTime / this.blendSmoothing);
                    else
                        group.relativeWeightsBlended[m] = group.relativeWeights[m];
                    //AssertSane(group.relativeWeights[m],"group.relativeWeights[m]");
                    //AssertSane(group.relativeWeightsBlended[m],"group.relativeWeightsBlended[m]");
                    //AssertSane(deltaTime / this.blendSmoothing,"deltaTime / blendSmoothing ( "+deltaTime+" / "+this.blendSmoothing+" )");
                    const weight = group.relativeWeightsBlended[m] * group.weight;
                    group.motionStates[m].weight = weight;
                    if (weight > 0) group.motionStates[m].enabled = true;
                    else group.motionStates[m].enabled = false;
                    //group.motionStates[m].layer = controllerLayer; //TODO figure out layers
                    // Remember which motion has the highest weight
                    // This will be used for checking that the weights
                    // are not changed by external factors.
                    if (weight > highestWeight) {
                        group.primaryMotionIndex = m;
                        highestWeight = weight;
                    }
                }
            }
            else {
                for (let m = 0; m < group.motionStates.length; m++) {
                    group.motionStates[m].weight = 0;
                    group.motionStates[m].enabled = false;
                }
                group.relativeWeightsBlended = null;
            }
        }

        // Handle weights of motions that are not in motions groups
        for (let m = 0; m < this.nonGroupMotionStates.length; m++) {
            let newWeight = this.nonGroupMotionStates[m].weight;
            if (this.nonGroupMotionStates[m].enabled == false) newWeight = 0;
            if (
                Math.abs(newWeight - this.nonGroupMotionWeights[m]) > smallWeightDifference
                || (newWeight == 0 && this.nonGroupMotionWeights[m] != 0)
            ) {
                newWeights = true;
                this.nonGroupMotionWeights[m] = newWeight;
            }
        }

        let justActivated = this.updateStates;
        if (newWeights || this.updateStates) {
            // Get summed weights
            this.summedMotionWeight = 0;
            this.summedCycleMotionWeight = 0;
            let cm = 0;
            for (let m = 0; m < this.legC.motions.length; m++) {
                this.motionWeights[m] = this.motionStates[m].weight;
                this.summedMotionWeight += this.motionWeights[m];
                if (this.legC.motions[m].motionType == MotionType.WalkCycle) {
                    this.cycleMotionWeights[cm] = this.motionWeights[m];
                    this.summedCycleMotionWeight += this.motionWeights[m];
                    cm++;
                }
            }
            if (this.summedMotionWeight == 0) {
                this.isActive = false;

                if (this.ghost != null) {
                    const go = this.ghost.GetComponent();//typeof(GhostOriginal)
                    go.Synch();
                }
                return;
            }
            else {
                if (this.isActive == false) justActivated = true;
                this.isActive = true;
            }

            // Make weights sum to 1
            for (let m = 0; m < this.legC.motions.length; m++) {
                this.motionWeights[m] /= this.summedMotionWeight;
            }
            if (this.summedCycleMotionWeight > 0) {
                for (let m = 0; m < this.legC.cycleMotions.length; m++) {
                    this.cycleMotionWeights[m] /= this.summedCycleMotionWeight;
                }
            }

            // Get blended cycle data (based on all animations)
            for (let leg = 0; leg < this.legs.length; leg++) {
                this.legStates[leg].stancePosition = Util.zero();
                this.legStates[leg].heelToetipVector = Util.zero();
            }
            for (let m = 0; m < this.legC.motions.length; m++) {
                const motion = this.legC.motions[m];
                const weight = this.motionWeights[m];
                if (weight > 0) {
                    for (let leg = 0; leg < this.legs.length; leg++) {
                        this.legStates[leg].stancePosition.add(motion.cycles[leg].stancePosition.clone().multiplyScalar(this.scale * weight));
                        this.legStates[leg].heelToetipVector.add(motion.cycles[leg].heelToetipVector.clone().multiplyScalar(this.scale * weight));

                    }
                }
            }

            // Ensure legs won't intersect WIP
            /*if (objectVelocity.x != 0 || objectVelocity.z != 0) {
                const perpObjectVelocity = new Vector3(-objectVelocity.z, objectVelocity.y, objectVelocity.x).normalized;
                Vector3[] stanceOffsets = new Vector3[legs.length];
                // Compare every leg with every other leg
                for (let leg=0; leg<legs.length; leg++) {
                    for (let other=0; other<leg; other++) {
                        const interStanceDir =
                            (legStates[leg].stancePosition + legStates[leg].heelToetipVector / 2)
                            - (legStates[other].stancePosition + legStates[other].heelToetipVector / 2);
                    	
                    	
                        //UnityEngine.Debug.Log(interStanceDir.x+", "+interStanceDir.z);
                    	
                        const stanceSpacing = Vector3.Dot(interStanceDir, perpObjectVelocity);
                    	
                        const spacing = 0.2f;
                        if (stanceSpacing < spacing) {
                            stanceOffsets[leg] = (spacing - stanceSpacing) * 0.5f * perpObjectVelocity;
                            stanceOffsets[other] = -(spacing - stanceSpacing) * 0.5f * perpObjectVelocity;
                        }
                    	
                        UnityEngine.Debug.Log("Leg "+other+"-"+leg+" stance spacing: "+stanceSpacing);
                    }
                }
            	
                for (let leg=0; leg<legs.length; leg++) {
                    legStates[leg].stancePosition += stanceOffsets[leg];
                }
            }*/

            // Get blended cycle data (based on cycle animations only)
            if (this.summedCycleMotionWeight > 0) {
                for (let leg = 0; leg < this.legs.length; leg++) {
                    this.legStates[leg].liftTime = 0;
                    this.legStates[leg].liftoffTime = 0;
                    this.legStates[leg].postliftTime = 0;
                    this.legStates[leg].prelandTime = 0;
                    this.legStates[leg].strikeTime = 0;
                    this.legStates[leg].landTime = 0;
                }
                for (let m = 0; m < this.legC.cycleMotions.length; m++) {
                    const motion = this.legC.cycleMotions[m];
                    const weight = this.cycleMotionWeights[m];
                    if (weight > 0) {
                        for (let leg = 0; leg < this.legs.length; leg++) {
                            this.legStates[leg].liftTime += motion.cycles[leg].liftTime * weight;
                            this.legStates[leg].liftoffTime += motion.cycles[leg].liftoffTime * weight;
                            this.legStates[leg].postliftTime += motion.cycles[leg].postliftTime * weight;
                            this.legStates[leg].prelandTime += motion.cycles[leg].prelandTime * weight;
                            this.legStates[leg].strikeTime += motion.cycles[leg].strikeTime * weight;
                            this.legStates[leg].landTime += motion.cycles[leg].landTime * weight;
                        }
                    }
                }
            }

            // Get blended stance time (based on cycle animations only)
            // - getting the average is tricky becuase stance time is cyclic!
            if (this.summedCycleMotionWeight > 0) {
                for (let leg = 0; leg < this.legs.length; leg++) {
                    const stanceTimeVector = new Vector2(0, 0);
                    for (let m = 0; m < this.legC.cycleMotions.length; m++) {
                        const motion = this.legC.cycleMotions[m];
                        const weight = this.cycleMotionWeights[m];
                        if (weight > 0) {
                            stanceTimeVector.add(new Vector2(
                                Math.cos(motion.cycles[leg].stanceTime * 2 * Math.PI),
                                Math.sin(motion.cycles[leg].stanceTime * 2 * Math.PI)
                            ).multiplyScalar(weight));
                        }
                    }
                    this.legStates[leg].stanceTime = Util.Mod(
                        Math.atan2(stanceTimeVector.y, stanceTimeVector.x) / 2 / Math.PI
                    );
                }
            }
        }

        let controlMotionStateWeight = this.controlMotionState.weight;
        if (!this.controlMotionState.enabled) controlMotionStateWeight = 0;
        this.locomotionWeight = Util.Clamp01(this.summedMotionWeight * controlMotionStateWeight);
        if (this.updateStates || justActivated) this.ResetSteps();

        // Calculate cycle distance and duration

        // TODO
        // Calculate exponent and multiplier

        /*const distanceExponent;
        if (legC.motions.length>=2) {
            distanceExponent = (
                Mathf.Log(legC.motions[1].cycleDistance / legC.motions[0].cycleDistance)
                /
                Mathf.Log(legC.motions[1].cycleSpeed / legC.motions[0].cycleSpeed)
            );
        }
        else { distanceExponent = 0.5f; }
        const distanceMultiplier = (
            legC.motions[0].cycleDistance
            * scale / Math.pow(legC.motions[0].cycleSpeed * scale, distanceExponent)
        );
    	
        // Find distance based on speed
        cycleDistance = distanceMultiplier * Math.pow(speed, distanceExponent);*/

        let cycleFrequency = 0;
        let animatedCycleSpeed = 0;
        for (let m = 0; m < this.legC.motions.length; m++) {
            /**@type {MotionAnalyzer} */
            // @ts-ignore
            const motion = this.legC.motions[m];
            const weight = this.motionWeights[m];
            if (weight > 0) {
                if (motion.motionType == MotionType.WalkCycle) {
                    cycleFrequency += (1 / motion.cycleDuration) * weight;
                }
                animatedCycleSpeed += motion.cycleSpeed * weight;
            }
        }
        let desiredCycleDuration = this.maxStepDuration;
        if (cycleFrequency > 0) desiredCycleDuration = 1 / cycleFrequency;

        // Make the step duration / step length relation follow a sqrt curve
        let speedMultiplier = 1;
        if (this.speed != 0) speedMultiplier = animatedCycleSpeed * this.scale / this.speed;
        if (speedMultiplier > 0) desiredCycleDuration *= /*Mathf.Sqrt(*/speedMultiplier/*)*/;

        // Enforce short enough step duration while rotating
        const verticalAngularVelocity = this.tr.angularVelocitySmoothed.clone().applyQuaternion(this.tr.rotation).projectOnVector(this.up).length()// Vector3.Project(this.tr.rotation * this.tr.angularVelocitySmoothed, this.up).length();
        if (verticalAngularVelocity > 0) {
            desiredCycleDuration = Math.min(
                this.maxStepRotation / verticalAngularVelocity,
                desiredCycleDuration
            );
        }

        // Enforce short enough step duration while accelerating
        const groundAccelerationMagnitude = Util.ProjectOntoPlane(this.tr.accelerationSmoothed, this.up).length();
        if (groundAccelerationMagnitude > 0) {
            desiredCycleDuration = Util.Clamp(
                this.maxStepAcceleration / groundAccelerationMagnitude,
                desiredCycleDuration / 2,
                desiredCycleDuration
            );
        }

        // Enforce short enough step duration in general
        desiredCycleDuration = Math.min(desiredCycleDuration, this.maxStepDuration);

        this.cycleDuration = desiredCycleDuration;

        // Set cycle distance
        //AssertSane(this.cycleDuration,"cycleDuration");
        //AssertSane(this.speed,"speed");
        this.cycleDistance = this.cycleDuration * this.speed;

        // Set time of all animations used in blending

        // Check if all legs are "parked" i.e. standing still
        let allParked = false;
        if (this.enableLegParking) {
            allParked = true;
            for (let leg = 0; leg < this.legs.length; leg++) {
                if (this.legStates[leg].parked == false) allParked = false;
            }
        }

        // Synchronize animations
        if (!allParked) {
            this.normalizedTime = Util.Mod(this.normalizedTime + (1 / this.cycleDuration) * deltaTime);
            for (let m = 0; m < this.legC.cycleMotions.length; m++) {
                if (this.legC.cycleMotions[m].constructor.name == "MotionAnalyzerBackwards") {
                    this.cycleMotionStates[m].time = (
                        1 - (this.normalizedTime - this.legC.cycleMotions[m].cycleOffset)
                    );
                } else {
                    //TODO  time vs normalized time?
                    this.cycleMotionStates[m].time = this.normalizedTime - this.legC.cycleMotions[m].cycleOffset;
                }
            }
        }

        this.updateStates = false;

        this.currentTime = time;

        if (this.ghost != null) {


            const go = this.ghost.GetComponent(typeof (GhostOriginal));
            go.Synch();
        }
    }

    FixedUpdate(deltaTime, timeScale = 1) {
        if (deltaTime == 0 || timeScale == 0) return;
        this.tr.ControlledFixedUpdate();
    }

    // Update is called once per frame
    LateUpdate(deltaTime, time, timeScale = 1) {
        if (deltaTime == 0 || timeScale == 0) return;

        //MonitorFootsteps();

        this.tr.ControlledLateUpdate();
        this.position = this.tr.position;
        this.rotation = this.tr.rotation;

        //AssertSane(this.tr.accelerationSmoothed, "acceleration");
        const wq=this.transform.getWorldQuaternion(new Quaternion())
        this.up = Util.up().applyQuaternion(wq);//this.rotation * Util.up;
        this.forward = Util.forward().applyQuaternion(wq);  //this.rotation * Vector3.forward;
        const right = Util.right().applyQuaternion(wq);// this.rotation * Vector3.right;

        // Do not run locomotion system in this frame if locomotion weights are all zero
        if (!this.isActive) return;
        if (this.currentTime != time) return;
        if (!this.useIK) return;

        const origLayer = this.transform.layers;// .layer;
        this.transform.layers.set(2);// = 2;

        for (let leg = 0; leg < this.legs.length; leg++) {

            // Calculate current time in foot cycle
            const designatedCycleTime = Util.CyclicDiff(this.normalizedTime, this.legStates[leg].stanceTime);

            // See if this time is beginning of a new step
            let newStep = false;
            if (designatedCycleTime < this.legStates[leg].designatedCycleTimePrev - 0.5) {
                newStep = true;
                this.legStates[leg].stepNr++;
                if (!this.legStates[leg].parked) {
                    this.legStates[leg].stepFromTime = this.legStates[leg].stepToTime;
                    this.legStates[leg].stepFromPosition = this.legStates[leg].stepToPosition;
                    this.legStates[leg].stepFromMatrix = this.legStates[leg].stepToMatrix;
                    //this.legStates[leg].debugHistory.Clear();
                    this.legStates[leg].cycleTime = designatedCycleTime;
                }
                this.legStates[leg].parked = false;

            }
            this.legStates[leg].designatedCycleTimePrev = designatedCycleTime;

            // Find future step time	
            this.legStates[leg].stepToTime = (
                time
                + (1 - designatedCycleTime) * this.cycleDuration
            );

            const predictedStrikeTime = (this.legStates[leg].strikeTime - designatedCycleTime) * this.cycleDuration;
            //const predictedStanceTime = (1-designatedCycleTime) * cycleDuration;

            if (
                (designatedCycleTime >= this.legStates[leg].strikeTime)
                //|| (legStates[leg].cycleTime >= cycleTimeNew)
            ) this.legStates[leg].cycleTime = designatedCycleTime;
            else {
                // Calculate how fast cycle must go to catch up from a possible parked state
                this.legStates[leg].cycleTime += (
                    (this.legStates[leg].strikeTime - this.legStates[leg].cycleTime)
                    * deltaTime / predictedStrikeTime // * 2
                    //(1-legStates[leg].cycleTime)
                    // * deltaTime/predictedStanceTime
                );
            }
            if (
                (this.legStates[leg].cycleTime >= designatedCycleTime)
            ) this.legStates[leg].cycleTime = designatedCycleTime;

            // Find future step position and alignment
            if (this.legStates[leg].cycleTime < this.legStates[leg].strikeTime) {

                // Value from 0.0 at liftoff time to 1.0 at strike time
                const flightTime = MathUtils.inverseLerp(
                    this.legStates[leg].liftoffTime, this.legStates[leg].strikeTime, this.legStates[leg].cycleTime);

                // Find future step alignment
                const newPredictedRotation = new Quaternion().setFromAxisAngle(this.tr.angularVelocitySmoothed, this.tr.angularVelocitySmoothed.length() * (this.legStates[leg].stepToTime - time)).multiply(this.tr.rotation);


                // Apply smoothing of predicted step rotation
                const predictedRotation = new Quaternion();
                if (this.legStates[leg].cycleTime <= this.legStates[leg].liftoffTime) {
                    // No smoothing if foot hasn't lifted off the ground yet
                    predictedRotation.copy(newPredictedRotation);
                }
                else {

                    const oldPredictedRotation = new Quaternion().setFromRotationMatrix(this.legStates[leg].stepToMatrix);//Util.QuaternionFromMatrix(this.legStates[leg].stepToMatrix);
                    oldPredictedRotation.multiplyQuaternions(new Quaternion().setFromUnitVectors(Util.up().applyQuaternion(oldPredictedRotation), this.up), oldPredictedRotation);


                    const rotationSeekSpeed = Math.max(
                        this.tr.angularVelocitySmoothed.length() * 3,
                        this.maxStepRotation / this.maxStepDuration
                    );
                    const maxRotateAngle = rotationSeekSpeed / flightTime * deltaTime;
                    predictedRotation.copy(Util.QuatConstantSlerp(
                        oldPredictedRotation, newPredictedRotation, maxRotateAngle));
                }

                // Find future step position (prior to raycast)
                let newStepPosition;

                // Find out how much the character is turning
                const turnSpeed = this.tr.angularVelocitySmoothed.dot(this.up);

                if (turnSpeed * this.cycleDuration < 5) {
                    // Linear prediction if no turning
                    newStepPosition = (this.legStates[leg].stancePosition.clone().applyQuaternion(predictedRotation)).add(this.tr.position).add(this.tr.velocity.clone().multiplyScalar(this.legStates[leg].stepToTime - time));


                }
                else {
                    // If character is turning, assume constant turning
                    // and do circle-based prediction
                    const turnCenter = this.up.clone().cross(this.tr.velocity).divideScalar(turnSpeed * Math.PI / 180);
                    const predPos = turnCenter.clone().add(
                        turnCenter.clone().multiplyScalar(-1).applyQuaternion(
                            new Quaternion().setFromAxisAngle(
                                this.up,
                                turnSpeed * (this.legStates[leg].stepToTime - time
                                )

                            )));

                    newStepPosition = this.legStates[leg].stancePosition.clone().applyQuaternion(predictedRotation).add(this.tr.position).add(predPos);

                }

                newStepPosition = Util.SetHeight(
                    newStepPosition, this.up.clone().multiplyScalar(this.scale).multiplyScalar(this.legC.groundPlaneHeight).add(this.position), this.up
                );

                // Get position and orientation projected onto the ground
                const groundedBase = this.FindGroundedBase(
                    newStepPosition,
                    predictedRotation,
                    this.legStates[leg].heelToetipVector,
                    true
                );
                newStepPosition = Util.MatGetColumn(groundedBase, 3);//GetColumn(3);

                // Apply smoothing of predicted step position
                if (newStep) {
                    // No smoothing if foot hasn't lifted off the ground yet
                    this.legStates[leg].stepToPosition = newStepPosition;
                    this.legStates[leg].stepToPositionGoal = newStepPosition;
                }
                else {
                    const stepSeekSpeed = Math.max(
                        this.speed * 3 + this.tr.accelerationSmoothed.length() / 10,
                        this.legs[leg].footLength * this.scale * 3
                    );

                    const towardStrike = this.legStates[leg].cycleTime / this.legStates[leg].strikeTime;

                    // Evaluate if new potential goal is within reach
                    if (
                        (newStepPosition.clone().sub(this.legStates[leg].stepToPosition)).lengthSq()
                        < Math.pow(stepSeekSpeed * ((1 / towardStrike) - 1), 2)
                    ) {
                        this.legStates[leg].stepToPositionGoal = newStepPosition;
                    }

                    // Move towards goal - faster initially, then slower
                    const moveVector = this.legStates[leg].stepToPositionGoal.clone().sub(this.legStates[leg].stepToPosition);
                    if (moveVector != Util.zero() && predictedStrikeTime > 0) {
                        const moveVectorMag = moveVector.length();
                        const moveDist = Math.min(
                            moveVectorMag,
                            Math.max(
                                stepSeekSpeed / Math.max(0.1, flightTime) * deltaTime,
                                (1 + 2 * Math.pow(towardStrike - 1, 2))
                                * (deltaTime / predictedStrikeTime)
                                * moveVectorMag
                            )
                        );

                        this.legStates[leg].stepToPosition.add(
                            this.legStates[leg].stepToPositionGoal.clone().sub(this.legStates[leg].stepToPosition).divideScalar(moveVectorMag).multiplyScalar(moveDist)

                        );
                    }
                }
                Util.MatSetColumn(groundedBase, 3, this.legStates[leg].stepToPosition);
                //groundedBase.SetColumn(3, this.legStates[leg].stepToPosition);
                //set column 3 row 3 to 1
                groundedBase.elements[15] = 1;

                this.legStates[leg].stepToMatrix = groundedBase;
            }

            if (this.enableLegParking) {

                // Check if old and new footstep has
                // significant difference in position or rotation
                const distToNextStep = Util.ProjectOntoPlane(
                    this.legStates[leg].stepToPosition.clone().sub(this.legStates[leg].stepFromPosition), this.up
                ).length();

                const significantStepDifference = (
                    distToNextStep > this.minStepDistance
                    ||
                    Util.MatGetColumn(this.legStates[leg].stepToMatrix, 2).angleTo(Util.MatGetColumn(this.legStates[leg].stepFromMatrix, 2)) > this.maxStepRotation / 2
                );

                // Park foot's cycle if the step length/rotation is below threshold
                if (newStep && !significantStepDifference) {
                    this.legStates[leg].parked = true;
                }

                // Allow unparking during first part of cycle if the
                // step length/rotation is now above threshold
                if (
                    this.legStates[leg].parked
                    //&& ( legStates[leg].cycleTime < 0.5f )
                    && (designatedCycleTime < 0.67)
                    && significantStepDifference
                ) {
                    this.legStates[leg].parked = false;
                }

                if (this.legStates[leg].parked) this.legStates[leg].cycleTime = 0;
            }
        }

        // Calculate base point
        const tangentDir = this.tr.velocity.clone().applyQuaternion(this.tr.rotation.clone().invert());
        // This is in object space, so OK to set y to 0
        tangentDir.y = 0;
        if (tangentDir.lengthSq() > 0) tangentDir.normalize();

        //AssertSane(this.cycleDistance, "cycleDistance");
        /**@type {Vector3[]} */
        const basePointFoot = new Array(this.legs.length);//Vector3[this.legs.length];
        const basePoint = Util.zero();
        const baseVel = Util.zero();
        const avgFootPoint = Util.zero();
        let baseSummedWeight = 0.0;
        for (let leg = 0; leg < this.legs.length; leg++) {
            // Calculate base position (starts and ends in tangent to surface)

            // weight goes 1 -> 0 -> 1 as cycleTime goes from 0 to 1
            const weight = Math.cos(this.legStates[leg].cycleTime * 2 * Math.PI) / 2.0 + 0.5;
            baseSummedWeight += weight + 0.001;

            // Value from 0.0 at lift time to 1.0 at land time
            const strideTime = MathUtils.inverseLerp(
                this.legStates[leg].liftTime, this.legStates[leg].landTime, this.legStates[leg].cycleTime);
            const strideSCurve = -Math.cos(strideTime * Math.PI) / 2 + 0.5;

            const stepBodyPoint = this.transform.localToWorld(this.legStates[leg].stancePosition.clone().normalize().multiplyScalar(-1)).multiplyScalar( this.scale);

            // AssertSane(this.legStates[leg].cycleTime, "legStates[leg].cycleTime");
            //AssertSane(strideSCurve, "strideSCurve");
            //AssertSane(tangentDir, "tangentDir");
            //AssertSane(this.cycleDistance, "cycleDistance");
            //AssertSane(this.legStates[leg].stepFromPosition, "legStates[leg].stepFromPosition");
            //AssertSane(this.legStates[leg].stepToPosition, "legStates[leg].stepToPosition");
            //AssertSane(this.legStates[leg].stepToMatrix.MultiplyVector(tangentDir), "stepToMatrix");
            //AssertSane(this.legStates[leg].stepFromMatrix.MultiplyVector(tangentDir), "stepToMatrix");
            basePointFoot[leg] = (
                
                    this.legStates[leg].stepFromPosition.clone().add(
                     tangentDir.clone().applyMatrix4(this.legStates[leg].stepFromMatrix).multiplyScalar(this.cycleDistance * this.legStates[leg].cycleTime)
                    
                ).multiplyScalar(1 - strideSCurve).add
                 (tangentDir.clone().applyMatrix4(this.legStates[leg].stepToMatrix).multiplyScalar(this.cycleDistance * (this.legStates[leg].cycleTime - 1)).add(
                    this.legStates[leg].stepToPosition)
                    
                ).multiplyScalar(strideSCurve)
            );
            //AssertSane(basePointFoot[leg], "basePointFoot[leg]");
          /*   if (Number.isNaN(basePointFoot[leg].x) || Number.isNaN(basePointFoot[leg].y) || Number.isNaN(basePointFoot[leg].z)) {
                UnityEngine.Debug.LogError("legStates[leg].cycleTime=" + this.legStates[leg].cycleTime + ", strideSCurve=" + strideSCurve + ", tangentDir=" + tangentDir + ", cycleDistance=" + this.cycleDistance + ", legStates[leg].stepFromPosition=" + this.legStates[leg].stepFromPosition + ", legStates[leg].stepToPosition=" + this.legStates[leg].stepToPosition + ", legStates[leg].stepToMatrix.MultiplyVector(tangentDir)=" + this.legStates[leg].stepToMatrix.MultiplyVector(tangentDir) + ", legStates[leg].stepFromMatrix.MultiplyVector(tangentDir)=" + this.legStates[leg].stepFromMatrix.MultiplyVector(tangentDir));
            } */

            basePoint.add(basePointFoot[leg].clone().add(stepBodyPoint).multiplyScalar(weight + 0.001));
            avgFootPoint.add( basePointFoot[leg]);

            baseVel.add(  this.legStates[leg].stepToPosition.clone().sub(this.legStates[leg].stepFromPosition) .multiplyScalar (1 - weight + 0.001))
        }
        //Assert(baseSummedWeight != 0, "baseSummedWeight is zero");
        avgFootPoint.divideScalar( this.legs.length);
        basePoint.divideScalar( baseSummedWeight);
        Number.isNaN
        if (
            Number.isNaN(basePoint.x)
            || Number.isNaN(basePoint.y)
            || Number.isNaN(basePoint.z)
        ) basePoint.copy( this.position);
        //AssertSane(basePoint, "basePoint");
        const groundBasePoint = this.up.clone().multiplyScalar( this.legC.groundPlaneHeight).add(basePoint);

        // Calculate base up vector
        const baseUp =new Vector3().copy( this.up);
        if (this.groundHugX >= 0 || this.groundHugZ >= 0) {

            // Ground-based Base Up Vector
            const baseUpGroundNew = this.up.clone().multiplyScalar(0.1);
            for (let leg = 0; leg < this.legs.length; leg++) {
                const vec = basePointFoot[leg].sub(avgFootPoint);
                baseUpGroundNew.add(vec.clone().cross(this.baseUpGround).cross(vec));
                //UnityEngine.Debug.DrawLine(basePointFoot[leg], avgFootPoint);
            }

            //Assert(up.length()>0, "up has zero length");
            //Assert(baseUpGroundNew.length()>0, "baseUpGroundNew has zero length");
            //Assert(Vector3.Dot(baseUpGroundNew,up)!=0, "baseUpGroundNew and up are perpendicular");
            const baseUpGroundNewUpPart = baseUpGroundNew.dot( this.up);
            if (baseUpGroundNewUpPart > 0) {
                // Scale vector such that vertical element has length of 1
                baseUpGroundNew.divideScalar(baseUpGroundNewUpPart);
               // AssertSane(baseUpGroundNew, "baseUpGroundNew");
                this.baseUpGround = baseUpGroundNew;
            }

            if (this.groundHugX >= 1 && this.groundHugZ >= 1) {
                baseUp.copy( this.baseUpGround).normalize();
            }
            else {
                baseUp.copy(this.baseUpGround.clone().projectOnVector(right).multiplyScalar(this.groundHugX).add(this.baseUpGround.clone().projectOnVector(this.forward).multiplyScalar(this.groundHugZ))).add(this.up).normalize();
                    
            }
        }

        // Velocity-based Base Up Vector
        const baseUpVel = this.up.clone();
        if (baseVel != Util.zero()) baseUpVel.copy(baseVel.clone().cross( this.up.clone().cross( baseVel)));
        // Scale vector such that vertical element has length of 1
        baseUpVel.divideScalar(baseUpVel.dot( this.up));

        // Calculate acceleration direction in local XZ plane
        const accelerationDir = Util.zero();
        if (this.accelerateTiltAmount * this.accelerateTiltSensitivity != 0) {
            const accelX = this.tr.accelerationSmoothed.clone().multiplyScalar(this.accelerateTiltSensitivity * this.accelerateTiltAmount).dot(
                
                right
            ) * (1 - this.groundHugX);
            const accelZ = this.tr.accelerationSmoothed.clone().multiplyScalar( this.accelerateTiltSensitivity * this.accelerateTiltAmount).dot(
                
                this.forward
            ) * (1 - this.groundHugZ);
            this.accelerationTiltX = MathUtils.lerp(this.accelerationTiltX, accelX, deltaTime * 10);
            this.accelerationTiltZ = MathUtils.lerp(this.accelerationTiltZ, accelZ, deltaTime * 10);
            accelerationDir.copy (
                right.clone().multiplyScalar(this.accelerationTiltX).add(this.forward.clone().multiplyScalar(this.accelerationTiltZ)).multiplyScalar
                // a curve that goes towards 1 as speed goes towards infinity:
                 (1 - 1 / (this.hSpeedSmoothed * this.accelerateTiltSensitivity + 1))
            );
        }

        // Calculate tilting direction in local XZ plane
        const tiltDir = Util.zero();
        if (this.climbTiltAmount * this.climbTiltAmount != 0) {
            tiltDir .copy (
                (
                    baseUpVel.clone().projectOnVector( right).multiplyScalar (1 - this.groundHugX).add(
                    baseUpVel.clone().projectOnVector( this.forward) .multiplyScalar (1 - this.groundHugZ))
                ) .multiplyScalar( -1*this.climbTiltAmount)
                // a curve that goes towards 1 as speed goes towards infinity:
                .multiplyScalar (1 - 1 / (this.hSpeedSmoothed * this.climbTiltSensitivity + 1))
            );
        }

        // Up vector and rotations for the torso
        this.bodyUp = baseUp.clone().add(accelerationDir).add(tiltDir).normalize();
        const bodyRotation = new Quaternion().setFromAxisAngle(
            this.up.clone().cross(this.bodyUp),
            this.up.angleTo(this.bodyUp)
        );

        // Up vector and rotation for the legs
        this.legsUp = this.up.clone().add(accelerationDir).normalize();
        const legsRotation = new Quaternion().setFromAxisAngle(

            this.up.clone().cross(this.legsUp),
            this.up.angleTo(this.legsUp)
        );

        for (let leg = 0; leg < this.legs.length; leg++) {
            // Value from 0.0 at liftoff time to 1.0 at strike time
            const flightTime = MathUtils.inverseLerp(
                this.legStates[leg].liftoffTime, this.legStates[leg].strikeTime, this.legStates[leg].cycleTime);
			
            // Value from 0.0 at lift time to 1.0 at land time
            const strideTime = MathUtils.inverseLerp(
                this.legStates[leg].liftTime, this.legStates[leg].landTime, this.legStates[leg].cycleTime);

            let phase;
            let phaseTime = 0;
            if (this.legStates[leg].cycleTime < this.legStates[leg].liftoffTime) {
                phase = 0; phaseTime = MathUtils.inverseLerp(
                    0, this.legStates[leg].liftoffTime, this.legStates[leg].cycleTime
                );
            }
            else if (this.legStates[leg].cycleTime > this.legStates[leg].strikeTime) {
                phase = 2; phaseTime = MathUtils.inverseLerp(
                    this.legStates[leg].strikeTime, 1, this.legStates[leg].cycleTime
                );
            }
            else {
                phase = 1; phaseTime = flightTime;
            }

            // Calculate foot position on foot flight path from old to new step
            const flightPos = Util.zero();
            for (let m = 0; m < this.legC.motions.length; m++) {
                const motion = this.legC.motions[m];
                const weight = this.motionWeights[m];
                if (weight > 0) {
                    // @ts-ignore
                    flightPos.add(motion.GetFlightFootPosition(leg, phaseTime, phase).multiplyScalar(weight));
                }
            }

            //AssertSane(flightPos, "flightPos");

            // Start and end point at step from and step to positions
            const pointFrom = this.legStates[leg].stepFromPosition;
            const pointTo = this.legStates[leg].stepToPosition;
            const normalFrom = Util.up().applyMatrix4(this.legStates[leg].stepFromMatrix);
            const normalTo =Util.up().applyMatrix4(this.legStates[leg].stepToMatrix);
            //Assert(Vector3.Dot(normalFrom, this.legsUp) > 0, "normalFrom and legsUp are perpendicular");
            //Assert(Vector3.Dot(normalFrom, this.legsUp) > 0, "normalTo and legsUp are perpendicular");

            //AssertSane(groundBasePoint, "groundBasePoint");
            //AssertSane(baseUp, "baseUp");

            const flightProgressionLift = Math.sin(flightPos.z * Math.PI);
            const flightTimeLift = Math.sin(flightTime * Math.PI);

            // Calculate horizontal part of flight paths
            this.legStates[leg].footBase = pointFrom.clone().multiplyScalar (1 - flightPos.z) .add(pointTo.clone().multiplyScalar(flightPos.z));

            const offset =this.legStates[leg].stancePosition.clone().applyQuaternion(this.tr.rotation).add(this.tr.position).sub(pointFrom.clone().lerp(pointTo,this.legStates[leg].cycleTime))
                
            
            this.legStates[leg].footBase.add(Util.ProjectOntoPlane(offset.clone().multiplyScalar( flightProgressionLift), this.legsUp));

            //for (let leg=0; leg<legs.length; leg++) {
            //	AddTrajectoryPoint("leg"+leg+"footbase",legStates[leg].footBase+up*0.01f+tr.rotation*legStates[leg].heelToetipVector*0);
            //}

           // AssertSane(this.legStates[leg].footBase, "legStates[leg].footBase");

            // Calculate vertical part of flight paths
            const midPoint = pointFrom.clone().add(pointTo).divideScalar( 2);
            const tangentHeightFrom = (
                normalFrom.dot( pointFrom.clone().sub(midPoint))
                / normalFrom.dot( this.legsUp)
            );
            const tangentHeightTo = (
                normalTo.dot( pointTo.clone().sub(midPoint))
                / normalTo.dot( this.legsUp)
            );
            const heightMidOffset = Math.max(tangentHeightFrom, tangentHeightTo) * 2 / Math.PI;
            //AssertSane(heightMidOffset, "heightMidOffset");

            this.legStates[leg].footBase.add(this.legsUp.clone().multiplyScalar(Math.max(0, heightMidOffset * flightProgressionLift - flightPos.y * this.scale))  );
           // AssertSane(this.legStates[leg].footBase, "legStates[leg].footBase");

			// Footbase rotation
			const footBaseRotationFromSteps =new Quaternion().setFromRotationMatrix(this.legStates[leg].stepFromMatrix).slerp(
            new Quaternion().setFromRotationMatrix(this.legStates[leg].stepToMatrix),flightTime);
            
		

            if (strideTime < 0.5) {
                this.legStates[leg].footBaseRotation =   new Quaternion().setFromRotationMatrix(this.legStates[leg].stepFromMatrix).slerp(
                    
                    this.rotation,
                    strideTime * 2
                );
            }
            else {
                this.legStates[leg].footBaseRotation = this.rotation.clone().slerp(
                    
                    new Quaternion().setFromRotationMatrix(this.legStates[leg].stepToMatrix),
                    strideTime * 2 - 1
                );
            }
            
            const footRotationAngle = this.rotation.angleTo(this.legStates[leg].footBaseRotation);
            if (footRotationAngle > this.maxFootRotationAngle) {
                this.legStates[leg].footBaseRotation = this.rotation.clone().slerp(
                    
                    this.legStates[leg].footBaseRotation,
                    this.maxFootRotationAngle / footRotationAngle
                );
            }

            this.legStates[leg].footBaseRotation = new Quaternion().setFromUnitVectors(
                Util.up().applyQuaternion(this.legStates[leg].footBaseRotation),
                 Util.up().applyQuaternion(footBaseRotationFromSteps)
            ).multiply(this.legStates[leg].footBaseRotation);

            // Elevate feet according to flight pas from keyframed animation
            this.legStates[leg].footBase.add( this.legsUp.clone().multiplyScalar(flightPos.y*this.scale));
         //   AssertSane(this.legStates[leg].footBase, "legStates[leg].footBase");

            // Offset feet sideways according to flight pas from keyframed animation
            const stepRight = this.legsUp.clone().cross( pointTo.clone().sub(pointFrom).normalize());
            this.legStates[leg].footBase.add( stepRight.clone().multiplyScalar(flightPos.x*this.scale));
            

            // Smooth lift that elevates feet in the air based on height of feet on the ground.
            const footBaseElevated = this.legStates[leg].footBase.clone().lerp(
                Util.SetHeight(this.legStates[leg].footBase.clone(), groundBasePoint, this.legsUp),
                flightTimeLift
            );

            if (footBaseElevated.dot(this.legsUp) > this.legStates[leg].footBase.dot( this.legsUp)) {
                this.legStates[leg].footBase = footBaseElevated;
            }

            /* UnityEngine.Debug.DrawLine(
                this.legStates[leg].footBase,
                this.legStates[leg].footBase + this.legStates[leg].footBaseRotation * this.legStates[leg].heelToetipVector,
                this.legs[leg].debugColor
            ); */
        }

        // Blend locomotion system effect in and out according to its weight

        for (let leg = 0; leg < this.legs.length; leg++) {
            const footBaseReference = this.legs[leg].ankle.localToWorld(this.legs[leg].ankleHeelVector.clone()).sub(
                GetHeelOffset(
                    this.legs[leg].ankle, this.legs[leg].ankleHeelVector,
                    this.legs[leg].toe, this.legs[leg].toeToetipVector,
                    this.legStates[leg].heelToetipVector,
                    this.legStates[leg].footBaseRotation
                )
             
            );
            //AssertSane(footBaseReference, "footBaseReference");

            if (this.locomotionWeight < 1) {
                this.legStates[leg].footBase = footBaseReference.clone().lerp(
                    
                    this.legStates[leg].footBase,
                    this.locomotionWeight
                );
                this.legStates[leg].footBaseRotation = this.rotation.clone().slerp(
                    
                    this.legStates[leg].footBaseRotation,
                    this.locomotionWeight
                );
            }

            this.legStates[leg].footBase=footBaseReference.clone().lerp(
                this.legStates[leg].footBase,
                Math.min(1,this.maxIKAdjustmentDistance/footBaseReference.distanceTo(this.legStates[leg].footBase) ) 
                );
        }

        // Apply body rotation
        this.legC.root.rotation.setFromQuaternion (
            this.tr.rotation.clone().multiply( this.transform.quaternion.clone().invert()).multiply( bodyRotation).multiply( this.legC.root.quaternion)
            
        );
        for (let leg = 0; leg < this.legs.length; leg++) {
            this.legs[leg].hip.setRotationFromQuaternion(legsRotation.clone().multiply(bodyRotation.clone().invert()).multiply(this.legs[leg].hip.quaternion));
        }

        // Apply root offset based on body rotation
        const rootPoint = this.legC.root.getWorldPosition(new Vector3());
        const hipAverage = this.transform.worldToLocal(this.legC.hipAverage.clone());
        const hipAverageGround = this.transform.worldToLocal(this.legC.hipAverageGround.clone());//transformPoint
        const rootPointAdjusted = rootPoint.clone();
        rootPointAdjusted.add( rootPointAdjusted.clone().sub(hipAverage).applyQuaternion(bodyRotation).sub(rootPoint).add(hipAverage));
        rootPointAdjusted.add( hipAverage.clone().sub(hipAverageGround).applyQuaternion(legsRotation).sub(hipAverage).add(hipAverageGround));
        
        rootPointAdjusted.add(this.position).sub(this.transform.getWorldPosition(new Vector3()));
        this.legC.root.worldToLocal(rootPointAdjusted);
        this.legC.root.position.copy(rootPointAdjusted)
        //this.legC.root.transform.position = rootPointAdjusted + this.position - this.transform.position;

        for (let leg = 0; leg < this.legs.length; leg++) {
            this.legStates[leg].hipReference = this.legs[leg].hip.position;
            this.legStates[leg].ankleReference = this.legs[leg].ankle.position;
        }

        // Adjust legs in two passes
        // First pass is to find approximate place of hips and ankles
        // Second pass is to adjust ankles based on local angles found in first pass
        for (let pass = 1; pass <= 2; pass++) {
            // Find the ankle position for each leg
            for (let leg = 0; leg < this.legs.length; leg++) {
                this.legStates[leg].ankle = GetAnklePosition(
                    this.legs[leg].ankle, this.legs[leg].ankleHeelVector,
                    this.legs[leg].toe, this.legs[leg].toeToetipVector,
                    this.legStates[leg].heelToetipVector,
                    this.legStates[leg].footBase, this.legStates[leg].footBaseRotation
                );
            }

            // Find and apply the hip offset
            this.FindHipOffset();

            // Adjust the legs according to the found ankle and hip positions
            for (let leg = 0; leg < this.legs.length; leg++) { this.AdjustLeg(leg, this.legStates[leg].ankle, pass == 2); }
        }

       /*  for (let leg = 0; leg < this.legs.length; leg++) {
            // Draw desired bone alignment lines
            for (let i = 0; i < this.legs[leg].legChain.length - 1; i++) {
                UnityEngine.Debug.DrawLine(
                    this.legs[leg].legChain[i].position,
                    this.legs[leg].legChain[i + 1].position,
                    this.legs[leg].debugColor
                );
            }
        } */

        const temp = this.position;
       /*  UnityEngine.Debug.DrawRay(temp, this.up / 10, Color.white);
        UnityEngine.Debug.DrawRay(temp - this.forward / 20, this.forward / 10, Color.white);
        UnityEngine.Debug.DrawLine(hipAverage, hipAverageGround, Color.white);

        UnityEngine.Debug.DrawRay(temp, baseUp * 2, Color.blue);
        UnityEngine.Debug.DrawRay(hipAverage, this.bodyUp * 2, Color.yellow);
 */
        this.transform.layers = origLayer;
    }



    /**
     * 
     
     * @param {Vector3} pos 
     
     * @param {Quaternion} rot 
     
     * @param {Vector3} heelToToetipVector 
     
     * @param {boolean} avoidLedges 
     * @returns {Matrix4}
     */
    FindGroundedBase(
        pos, rot, heelToToetipVector, avoidLedges
    ) {
        let hit;//RaycastHit

        // Trace rays
        const hitAPoint = new Vector3();
        const hitBPoint = new Vector3();
        const hitANormal = new Vector3();
        const hitBNormal = new Vector3();
        let hitA = false;
        let hitB = false;
        let valid = false;

        let hits = this.raycast(
            this.up.clone().multiplyScalar(this.maxStepHeight).add(pos),
            this.up.clone().multiplyScalar(-1), this.maxStepHeight * 2, this.groundLayers)
        if (hits?.length) {
            valid = true;
            hitAPoint.copy(hits[0].point);
            // Ignore surface normal if it deviates too much
            if (hits[0].normal.angleTo(this.up) < this.maxSlopeAngle) {
                hitANormal.copy(hits[0].normal); hitA = true;
            }
        }

        const heelToToetip = heelToToetipVector.clone().applyQuaternion(rot);
        const footLength = heelToToetip.length();

        hits=this.raycast(
            this.up.clone().multiplyScalar(this.maxStepHeight).add(heelToToetip).add(pos),
            this.up.clone().multiplyScalar(-1), this.maxStepHeight * 2, this.groundLayers)
        if(hits?.length) {
            valid = true;
            hitBPoint.copy(hits[0].point);
            // Ignore surface normal if it deviates too much
            if (hits[0].normal.angleTo(this.up) < this.maxSlopeAngle) {
                hitBNormal.copy(hits[0].normal); hitB = true;
            }
        }

        if (!valid) {
            const m = new Matrix4().identity();//Matrix4x4.identity;
            m.compose(pos, rot, new Vector3(1, 1, 1));
            //m.SetTRS(pos, rot, Vector3.one);
            return m;
        }

        // Choose which raycast result to use
        let exclusive = false;
        if (avoidLedges) {
            if (!hitA && !hitB) hitA = true;
            else if (hitA && hitB) {
                const avgNormal = hitANormal.clone().add(hitBNormal).normalize();
                const hA = hitAPoint.dot(avgNormal);
                const hB = hitBPoint.dot(avgNormal);
                if (hA >= hB) hitB = false;
                else hitA = false;
                if (Math.abs(hA - hB) > footLength / 4) exclusive = true;
            }
            else exclusive = true;
        }

        let newStepPosition;

        const stepUp = Util.up().applyQuaternion(rot);

        // Apply result of raycast
        if (hitA) {
            if (hitANormal != Util.zero()) {
                rot = new Quaternion().setFromUnitVectors(stepUp, hitANormal).multiply(rot)
            }
            newStepPosition = hitAPoint;
            if (exclusive) {
                heelToToetip.copy(heelToToetipVector.clone().applyQuaternion(rot));
                newStepPosition.sub(heelToToetip.clone().multiplyScalar(0.5));
            }
        }
        else {
            if (hitBNormal != Util.zero()) {
                rot.multiplyQuaternions(new Quaternion().setFromUnitVectors(stepUp, hitBNormal), rot) //Quaternion.FromToRotation(stepUp, hitBNormal) * rot;
            }
            heelToToetip.copy(heelToToetipVector.clone().applyQuaternion(rot));
            newStepPosition = hitBPoint.clone().sub(heelToToetip);
            if (exclusive) { newStepPosition.add(heelToToetip.clone().multiplyScalar(0.5)) }
        }

        return Util.MatrixFromQuaternionPosition(rot, newStepPosition);
    }

    FindHipOffset() {
        let lowestDesiredHeight = Number.POSITIVE_INFINITY;//Mathf.Infinity;
        let lowestMaxHeight = Number.POSITIVE_INFINITY;
        let averageDesiredHeight = 0;
        // AssertSane(this.legsUp, "legsUp");
        for (let leg = 0; leg < this.legs.length; leg++) {
            /**@type {number[]} */
            let intersections = null;

            // Calculate desired distance between original foot base position and original hip position
            const desiredVector = this.legStates[leg].ankleReference.clone().sub(this.legStates[leg].hipReference);
            const desiredDistance = desiredVector.length();
            const desiredDistanceGround = Util.ProjectOntoPlane(desiredVector, this.legsUp).length();

            // Move closer if too far away
            const ankleVectorGround = Util.ProjectOntoPlane(
                this.legStates[leg].ankle.clone().sub(this.legs[leg].hip.position), this.legsUp
            );
            const excess = ankleVectorGround.length() - desiredDistanceGround;
            if (excess > 0) {
                const bufferDistance = (this.legs[leg].legLength * this.scale * 0.999) - desiredDistanceGround;
                this.legStates[leg].ankle.sub(ankleVectorGround).add(ankleVectorGround.clone().normalize())
                    .multiplyScalar(
                        desiredDistanceGround
                        + (1 - (1 / (excess / bufferDistance + 1))) * bufferDistance

                    );
            }

            // Find the desired hip height (relative to the current hip height)
            // such that the original distance between ankle and hip is preserved.
            // (Move line start and sphere center by minus line start to avoid precision errors)
            intersections = Util.GetLineSphereIntersections(
                Util.zero(), this.legsUp,
                this.legStates[leg].ankle.clone().sub(this.legs[leg].hip.position),
                desiredDistance
            );
            let hipDesiredHeight;
            if (intersections != null) {
                hipDesiredHeight = intersections[1];
                //AssertSane(hipDesiredHeight, "hipDesiredHeight (intersection)");
            }
            else {
                hipDesiredHeight = this.legStates[leg].footBase.clone().sub(this.legs[leg].hip.position).dot(this.legsUp);
                /*UnityEngine.Debug.Log(
                    gameObject.name
                    +": Line-sphere intersection failed for leg "+leg+", hipDesiredHeight."
                );*/
            }

            // Find the maximum hip height (relative to the current hip height) such that the
            // distance between the ankle and hip is no longer than the length of the leg bones combined.
            // (Move line start and sphere center by minus line start to avoid precision errors)
            intersections = Util.GetLineSphereIntersections(
                Util.zero(), this.legsUp,
                this.legStates[leg].ankle.clone().sub(this.legs[leg].hip.position),
                (this.legs[leg].legLength * this.scale * 0.999)
            );
            let hipMaxHeight;
            if (intersections != null) hipMaxHeight = intersections[1];
            else {
                hipMaxHeight = this.legStates[leg].ankle.clone().sub(this.legs[leg].hip.position).dot(this.legsUp);
                /* UnityEngine.Debug.Log(
                    gameObject.name
                    + ": Line-sphere intersection failed for leg " + leg + ", hipMaxHeight."
                ); */
            }

            // Find the lowest (and average) heights
            if (hipDesiredHeight < lowestDesiredHeight) { lowestDesiredHeight = hipDesiredHeight; }
            if (hipMaxHeight < lowestMaxHeight) { lowestMaxHeight = hipMaxHeight; }
            averageDesiredHeight += hipDesiredHeight / this.legs.length;
        }

        /* Assert(lowestDesiredHeight != Mathf.Infinity, "lowestDesiredHeight is infinite");
        Assert(lowestMaxHeight != Mathf.Infinity, "lowestMaxHeight is infinite");
        AssertSane(averageDesiredHeight, "averageDesiredHeight");
        AssertSane(lowestDesiredHeight, "lowestDesiredHeight");
        AssertSane(lowestMaxHeight, "lowestMaxHeight"); */

        // Find offset that is in between lowest desired, average desired, and lowest max
        if (lowestDesiredHeight > lowestMaxHeight) lowestDesiredHeight = lowestMaxHeight;
        const minToAvg = averageDesiredHeight - lowestDesiredHeight;
        const minToMax = lowestMaxHeight - lowestDesiredHeight;

        let hipHeight = lowestDesiredHeight;
        if (minToAvg + minToMax > 0) { // make sure we don't divide by zero
            hipHeight += minToAvg * minToMax / (minToAvg + minToMax);
        }

        // Translate the root by this offset
        //AssertSane(hipHeight, "hipHeight");
        this.legC.root.position.copy(this.legC.root.worldToLocal(this.legC.root.getWorldPosition(new Vector3()).add(this.legsUp.clone().multiplyScalar(hipHeight))))
        //this.legC.root.position += hipHeight * this.legsUp;
    }
    /**
     * 
     * @param {number} leg 
     * @param {Vector3} desiredAnklePosition 
     * @param {boolean} secondPass 
     */
    AdjustLeg(leg, desiredAnklePosition,  secondPass) {
        const legInfo = this.legs[leg];
        const legState = this.legStates[leg];

        // Store original foot alignment
        let qAnkleOrigRotation;
        if (!secondPass) {
            // Footbase rotation in character space
            const objectToFootBaseRotation = this.legStates[leg].footBaseRotation.clone().multiply(this.rotation.clone().invert());
            qAnkleOrigRotation = objectToFootBaseRotation.multiply(legInfo.ankle.quaternion);
        }
        else {
            qAnkleOrigRotation = legInfo.ankle.quaternion;
        }

        // Choose IK solver
        let ikSolver;
        if (legInfo.legChain.length == 3) ikSolver = new IK1JointAnalytic();
        else ikSolver = new IKSimple();

        // Solve the inverse kinematics
        ikSolver.Solve(legInfo.legChain, desiredAnklePosition);

        // Calculate the desired new joint positions
        const pHip = legInfo.hip.position;
        const pAnkle = legInfo.ankle.position;

        if (!secondPass) {
            // Find alignment that is only rotates in horizontal plane
            // and keeps local ankle angle
            const horizontalRotation = new Quaternion().setFromUnitVectors(
            this.forward,
            Util.ProjectOntoPlane(Util.forward().applyQuaternion( this.legStates[leg].footBaseRotation), this.up)
        ).multiply( legInfo.ankle.quaternion);

            // Apply original foot alignment when foot is grounded
            legInfo.ankle.rotation.setFromQuaternion(horizontalRotation.clone().slerp(// only horizontal rotation (keep local angle)
                 
                qAnkleOrigRotation, // rotates to slope of ground
                1 - legState.GetFootGrounding(legState.cycleTime)
            ));
        }
        else {
            // Rotate leg around hip-ankle axis by half amount of what the foot is rotated
            const hipAnkleVector = pAnkle.clone().sub(pHip);
            const legAxisRotate = new Quaternion().slerp(

                new Quaternion().setFromUnitVectors(
                    Util.ProjectOntoPlane(this.forward, hipAnkleVector),
                    Util.ProjectOntoPlane(Util.forward().applyQuaternion(this.legStates[leg].footBaseRotation), hipAnkleVector)
                ),
                0.5
            );
            legInfo.hip.rotation.setFromQuaternion( legAxisRotate.clone().multiply( legInfo.hip.quaternion));

            // Apply foot alignment found in first pass
            legInfo.ankle.rotation.setFromQuaternion(qAnkleOrigRotation);
        }
    }



    /* 
        MonitorFootsteps() {
            for (let legNr = 0; legNr < this.legStates.length; legNr++) {
                const legState = this.legStates[legNr];
                switch (legState.phase) {
                    case LegCyclePhase.Stance:
                        if (legState.cycleTime >= legState.liftTime && legState.cycleTime < legState.landTime) {
                            legState.phase = LegCyclePhase.Lift;
                            SendMessage("OnFootLift", SendMessageOptions.DontRequireReceiver);
                        }
                        break;
                    case LegCyclePhase.Lift:
                        if (legState.cycleTime >= legState.liftoffTime || legState.cycleTime < legState.liftTime) {
                            legState.phase = LegCyclePhase.Flight;
                            SendMessage("OnFootLiftoff", SendMessageOptions.DontRequireReceiver);
                        }
                        break;
                    case LegCyclePhase.Flight:
                        if (legState.cycleTime >= legState.strikeTime || legState.cycleTime < legState.liftoffTime) {
                            legState.phase = LegCyclePhase.Land;
                            SendMessage("OnFootStrike", SendMessageOptions.DontRequireReceiver);
                        }
                        break;
                    case LegCyclePhase.Land:
                        if (legState.cycleTime >= legState.landTime || legState.cycleTime < legState.strikeTime) {
                            legState.phase = LegCyclePhase.Stance;
                            SendMessage("OnFootLand", SendMessageOptions.DontRequireReceiver);
                        }
                        break;
                }
            }
        }
     */
}
