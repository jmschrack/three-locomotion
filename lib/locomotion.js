/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/

import { Vector2, Vector3, Quaternion, Color, Matrix4, MathUtils, Object3D, AnimationAction } from "three";
import * as Util from "./util";
import { up, zero, SampleAnimation, RelativeMatrix } from "./util";
import { IMotionAnalyzer, MotionAnalyzer, MotionAnalyzerBackwards } from "./motionAnalyzerBackwards";
import { MotionType } from "./data";
import { PolarGradientBandInterpolator } from "./polarGradientBandInterpolator";

export class LegInfo {
    constructor() {
        /**@type {Object3D[]} */
        this.legChain = [];
        /**@type {Object3D[]} */
        this.footChain = [];
        this.legLength = 0;
        this.ankleHeelVector = new Vector3();
        this.toeToetipVector = new Vector3();
        this.debugColor = new Color();
        //public 
        /**@type {Object3D} */
        this.hip = null;
        /**@type {Object3D} */
        this.ankle = null;
        /**@type {Object3D} */
        this.toe = null;
        this.footWidth = 0;
        this.footLength = 0;
        this.footOffset = new Vector2;
    }

}


export class MotionGroupInfo {
    constructor() {
        this.name = "";
        /**@type {IMotionAnalyzer[]} */
        this.motions = [];
        this.interpolator = null;

    }
    /* 	public string name;
    
        public IMotionAnalyzer[] motions;
    
        public Interpolator interpolator; */
    //public float[] 
    /**
     * 
     
     * @param {Vector3} velocity 
     * @returns {number[]}
     */
    GetMotionWeights(velocity) {
        return this.interpolator.Interpolate([velocity.x, velocity.y, velocity.z]);
    }
}


export class LegController {

    constructor() {

        /**@type {Object3D} */
        this.transform = null;

        this.groundPlaneHeight = 0;
        /**@type {AnimationAction} */
        this.groundedPose = null;
        /**@type {Object3D} */
        this.rootBone = null;
        /**@type {LegInfo[]} */
        this.legs = [];
        /**@type {MotionAnalyzer[]} */
        this.sourceAnimations = [];
        this.initialized = false;
        /**@type {MotionAnalyzerBackwards[]} */
        this.sourceAnimationsBackwards = [];
        this.m_HipAverage = new Vector3();
        this.m_HipAverageGround = new Vector3();
        /**@type {IMotionAnalyzer[]} */
        this.m_Motions = [];
        /**@type {IMotionAnalyzer[]} */
        this.m_CycleMotions = [];
        /**@type {MotionGroupInfo[]} */
        this.m_MotionGroups = [];
        /**@type {IMotionAnalyzer[]} */
        this.m_NonGroupMotions = [];
    }
    get nonGroupMotions() { return this.m_NonGroupMotions; }
    get cycleMotions() { return this.m_CycleMotions; }
    get name() { return this.transform.name; }
    get root() {
        return this.rootBone;
    }
    get hipAverage() {
        return this.m_HipAverage;
    }
    get hipAverageGround() {
        return this.m_HipAverageGround;
    }
    get motions() {
        return this.m_Motions;
    }
    get motionGroups() {
        return this.m_MotionGroups;
    }
    /* public float groundPlaneHeight;

    public AnimationClip groundedPose; */

    /*[HideInInspector]*/
    /* public Transform rootBone;
    public Transform root { get { return rootBone; } }

    public LegInfo[] legs;

    public MotionAnalyzer[] sourceAnimations;

    [HideInInspector] public bool initialized = false;

    [HideInInspector] public MotionAnalyzerBackwards[] sourceAnimationsBackwards;

    [HideInInspector] public Vector3 m_HipAverage; */
    //public Vector3 hipAverage { get { return m_HipAverage; } }
    //[HideInInspector] public Vector3 m_HipAverageGround;
    /* public Vector3 hipAverageGround { get { return m_HipAverageGround; } }

    [HideInInspector] public IMotionAnalyzer[] m_Motions;
    public IMotionAnalyzer[] motions { get { return m_Motions; } }

    [HideInInspector] public IMotionAnalyzer[] m_CycleMotions;
    public IMotionAnalyzer[] cycleMotions { get { return m_CycleMotions; } }

    [HideInInspector] public MotionGroupInfo[] m_MotionGroups;
    public MotionGroupInfo[] motionGroups { get { return m_MotionGroups; } }

    [HideInInspector] public IMotionAnalyzer[] m_NonGroupMotions;
    public IMotionAnalyzer[] nonGroupMotions { get { return m_NonGroupMotions; } }
 */
    InitFootData(leg = 0) {
        // Make sure character is in grounded pose before analyzing
        //this.groundedPose.SampleAnimation(this.transform, 0);
        SampleAnimation(this.groundedPose, 0);
        // Give each leg a color

        //const colorVect = new Vector3().copy(right);
        //colorVect.applyQuaternion(new Quaternion().setFromAxisAngle(one, leg * 360.0 * MathUtils.DEG2RAD / this.legs.length));
        //AngleAxis(leg * 360.0 / legs.length, Vector3.one) * Vector3.right;
        // this.legs[leg].debugColor = new Color(colorVect.x, colorVect.y, colorVect.z);

        // Calculate heel and toetip positions and alignments

        // (The vector from the ankle to the ankle projected onto the ground at the stance pose
        // in local coordinates relative to the ankle transform.
        // This essentially is the ankle moved to the bottom of the foot, approximating the heel.)

        // Get ankle position projected down onto the ground
        const ankleMatrix = RelativeMatrix(this.legs[leg].ankle, this.transform);
        // const ankleMatrixInverse = Util.InverseRelativeMatrix(this.legs[leg].ankle, this.transform);
        const anklePosition = zero().applyMatrix4(ankleMatrix);//Util.MultiplyVector(zero.clone(),ankleMatrix);//ankleMatrix(zero.clone());
       
        const heelPosition = anklePosition.clone();
        heelPosition.y = this.groundPlaneHeight;

        // Get toe position projected down onto the ground
        const toeMatrix = Util.RelativeMatrix(this.legs[leg].toe, this.transform);

        const toePosition = zero().applyMatrix4(toeMatrix);//Util.MultiplyVector(zero.clone(),toeMatrix);//toeMatrix(zero.clone());

        const toetipPosition = toePosition.clone();
        toetipPosition.y = this.groundPlaneHeight;

        // Calculate foot middle and vector
        const footMiddle = heelPosition.clone().add(toetipPosition).divideScalar(2);// (heelPosition + toetipPosition) / 2;
        let footVector;
        if (toePosition == anklePosition) {
            //footVector = ankleMatrix.MultiplyVector(legs[leg].ankle.localPosition);
            footVector=Util.MultiplyVector(this.legs[leg].ankle.position.clone(),ankleMatrix);
            footVector.y = 0;
            footVector.normalize();
        }
        else {
            footVector = toetipPosition.clone().sub(heelPosition).normalize();
        }


        const footSideVector = up().cross(footVector);
        console.log(`footVector ${leg} is ${footVector.toArray().join(',')} footSideVector:${footSideVector.toArray().join(',')}`);

        //this.legs[leg].ankleHeelVector = footVector.clone().multiplyScalar((-1 * this.legs[leg].footLength / 2) + this.legs[leg].footOffset.y).add(footSideVector.clone().multiplyScalar(this.legs[leg].footOffset.x)).add(footMiddle);
        const s = ((this.legs[leg].footLength * -1) / 2) + this.legs[leg].footOffset.y
        const ankleHeelVector = footVector.clone().multiplyScalar(s).add(footMiddle).add(footSideVector.clone().multiplyScalar(this.legs[leg].footOffset.x))

//        console.log("AnkleHeelVector before inversion", ankleHeelVector.clone().sub(anklePosition).toArray().join(','));
        this.legs[leg].ankleHeelVector = ankleHeelVector;
        this.legs[leg].ankleHeelVector = Util.MultiplyVector(ankleHeelVector.clone().sub(anklePosition), ankleMatrix.clone().invert());//ankleMatrixInverse(ankleHeelVector.clone().sub(anklePosition));
        this.legs[leg].ankleHeelVector.multiplyScalar(100);
  //      console.log("AnkleHeelVector after inversion" + this.legs[leg].ankleHeelVector.toArray().join(','));
  const s2 = ((this.legs[leg].footLength) / 2) + this.legs[leg].footOffset.y
        this.legs[leg].toeToetipVector=footVector.clone().multiplyScalar(s2).add(footMiddle).add(footSideVector.clone().multiplyScalar(this.legs[leg].footOffset.x))

       // this.legs[leg].toeToetipVector = footVector.clone().multiplyScalar((this.legs[leg].footLength / 2) + this.legs[leg].footOffset.y).add(footSideVector.clone().multiplyScalar(this.legs[leg].footOffset.x)).add(footMiddle);
       
       
        this.legs[leg].toeToetipVector= Util.MultiplyVector(this.legs[leg].toeToetipVector.clone().sub(toePosition), toeMatrix.clone().invert());
        this.legs[leg].toeToetipVector.multiplyScalar(100);
        //if (this.legs[leg].toeToetipVector.toArray().some(n => Number.isNaN(n))) console.error("toeToetipVector2 is NaN");
        //legs[leg].toeToetipVector = toeMatrix.inverse.MultiplyVector(legs[leg].toeToetipVector - toePosition);
        console.log(`InitFootData::${leg}:`, this.legs[leg]);
    }

    Init() {

        // Only set initialized to true in the end, when we know that no errors have occurred.
        this.initialized = false;
        console.log("Initializing " + this.name + " Locomotion System...");

        // Find the skeleton root (child of the GameObject) if none has been set already
        if (this.rootBone == null) {
            if (this.legs[0].hip == null) { console.error(name + ": Leg Transforms are null.", this); return; }
            this.rootBone = this.legs[0].hip;
            while (this.root.parent != this.transform) {
                this.rootBone = this.root.parent;
                if (this.rootBone.name == "mixamorig:Hips") break;
            }
        }

        // Calculate data for LegInfo objects
        this.m_HipAverage = zero();
        for (let leg = 0; leg < this.legs.length; leg++) {
            // Calculate leg bone chains
            if (this.legs[leg].toe == null) this.legs[leg].toe = this.legs[leg].ankle;
            this.legs[leg].legChain = this.GetTransformChain(this.legs[leg].hip, this.legs[leg].ankle);
            this.legs[leg].footChain = this.GetTransformChain(this.legs[leg].ankle, this.legs[leg].toe);

            // Calculate length of leg
            this.legs[leg].legLength = 0;
            for (let i = 0; i < this.legs[leg].legChain.length - 1; i++) {
                const lcp1 = new Vector3()
                const lcp2 = new Vector3();
                this.legs[leg].legChain[i + 1].getWorldPosition(lcp1)
                this.legs[leg].legChain[i].getWorldPosition(lcp2);
                this.legs[leg].legLength += (
                    this.transform.worldToLocal(lcp1).sub(this.transform.worldToLocal(lcp2))
                ).length();
                console.log("Leg " + leg + " length: " + this.legs[leg].legLength + ` via ${this.legs[leg].legChain[i + 1].position.toArray().join(',')} and ${this.legs[leg].legChain[i].position.toArray().join(',')}`);
                if (Number.isNaN(this.legs[leg].legLength)) console.error(`legLength ${leg} is NaN`);
            }
            const lcp = new Vector3();
            this.legs[leg].legChain[0].getWorldPosition(lcp);
            this.m_HipAverage.add(this.transform.worldToLocal(lcp));
            if (this.m_HipAverage.toArray().some(n => Number.isNaN(n))) console.error("m_HipAverage is NaN");
            this.InitFootData(leg);
        }
        this.m_HipAverage.divideScalar(this.legs.length);
        this.m_HipAverageGround = this.m_HipAverage;
        this.m_HipAverageGround.y = this.groundPlaneHeight;
    }

    Init2() {
        // Analyze motions
        //<MotionAnalyzerBackwards[] 
        /** @type {MotionAnalyzerBackwards[]} */
        const sourceAnimationBackwardsList = [];//new List<MotionAnalyzerBackwards>();
        for (let i = 0; i < this.sourceAnimations.length; i++) {

            // Initialize motion objects
            console.log("Analysing sourceAnimations[" + i + "]: " + this.sourceAnimations[i].name);

            this.sourceAnimations[i].Analyze(this,this.transform);

            // Also initialize backwards motion, if specified
            if (this.sourceAnimations[i].alsoUseBackwards) {
                const backwards = new MotionAnalyzerBackwards();
                backwards.orig = this.sourceAnimations[i];
                backwards.Analyze(this);
                sourceAnimationBackwardsList.push(backwards);
            }
        }
        this.sourceAnimationsBackwards = sourceAnimationBackwardsList;

        // Motion sampling have put bones in random pose...
        // Reset to grounded pose, time 0
        SampleAnimation(this.groundedPose, 0);

        this.initialized = true;

        console.log("Initializing " + this.name + " Locomotion System... Done!");
    }

    Awake() {

        if (!this.initialized) { console.error(this.name + ": Locomotion System has not been initialized.", this); return; }

        // Put regular and backwards motions into one array
        this.m_Motions = new IMotionAnalyzer[this.sourceAnimations.length + this.sourceAnimationsBackwards.length];
        for (let i = 0; i < this.sourceAnimations.length; i++) {
            this.motions[i] = this.sourceAnimations[i];
        }
        for (let i = 0; i < this.sourceAnimationsBackwards.length; i++) {
            this.motions[this.sourceAnimations.length + i] = this.sourceAnimationsBackwards[i];
        }

        // Get number of walk cycle motions and put them in an array
        let cycleMotionAmount = 0;
        for (let i = 0; i < this.motions.length; i++) {
            if (this.motions[i].motionType == MotionType.WalkCycle) cycleMotionAmount++;
        }
        this.m_CycleMotions = new IMotionAnalyzer[cycleMotionAmount];
        let index = 0;
        for (let i = 0; i < this.motions.length; i++) {
            if (this.motions[i].motionType == MotionType.WalkCycle) {
                this.cycleMotions[index] = this.motions[i];
                index++;
            }
        }

        // Setup motion groups
        /**@type {string[]} */
        const motionGroupNameList = [];
        /**@type {MotionGroupInfo[]} */
        const motionGroupList = [];//new List < MotionGroupInfo > ();
        /**@type {IMotionAnalyzer[][]} */
        const motionGroupMotionLists = [[]];// new List < List < IMotionAnalyzer >> ();
        /**@type {IMotionAnalyzer[]} */
        const nonGroupMotionList = [];//new List < IMotionAnalyzer > ();
        for (let i = 0; i < this.motions.length; i++) {
            if (this.motions[i].motionGroup == "") {
                nonGroupMotionList.push(this.motions[i]);
            }
            else {
                const groupName = this.motions[i].motionGroup;
                if (!motionGroupNameList.includes(groupName)) {
                    // Name is new so create a new motion group
                    const m = new MotionGroupInfo();

                    // Use it as controller for our new motion group
                    m.name = groupName;
                    motionGroupList.push(m);
                    motionGroupNameList.push(groupName);
                    motionGroupMotionLists.push([]);
                }
                motionGroupMotionLists[motionGroupNameList.indexOf(groupName)].push(this.motions[i]);
            }
        }
        this.m_NonGroupMotions = nonGroupMotionList;//.ToArray();
        this.m_MotionGroups = motionGroupList;//.ToArray();
        for (let g = 0; g < this.motionGroups.length; g++) {
            this.motionGroups[g].motions = motionGroupMotionLists[g];//.ToArray();
        }

        // Set up parameter space (for each motion group) used for automatic blending
        for (let g = 0; g < this.motionGroups.length; g++) {
            /**@type {MotionGroupInfo} */
            const group = this.motionGroups[g];
            /**@type {Vector3[]} */
            const motionVelocities = new Array(group.motions.length);// Vector3[group.motions.length];
            /**@type {number[][]} */
            const motionParameters = new Array(group.motions.length);// float[group.motions.length][];

            for (let i = 0; i < group.motions.length; i++) {
                motionVelocities[i] = group.motions[i].cycleVelocity;
                motionParameters[i] = [motionVelocities[i].x, motionVelocities[i].y, motionVelocities[i].z]
            }
            group.interpolator = new PolarGradientBandInterpolator(motionParameters);
        }

        // Calculate offset time values for each walk cycle motion
        this.CalculateTimeOffsets();
    }

    // Get the chain of transforms from one transform to a descendent one
    /**
     * 
     * @param {Object3D} upper 
     * @param {Object3D} lower 
     * @returns {Object3D[]}
     */
    GetTransformChain(upper, lower) {
        let t = lower;
        let chainLength = 1;
        while (t != upper) {
            t = t.parent;
            chainLength++;
        }
        /**@type {Object3D[]} */
        const chain = new Array(chainLength);//Transform[chainLength];
        t = lower;
        for (let j = 0; j < chainLength; j++) {
            chain[chainLength - 1 - j] = t;
            t = t.parent;
        }
        return chain;
    }

    CalculateTimeOffsets() {
        /**@type {number[]} */
        const offsets = new Array(this.cycleMotions.length);
        /**@type {number[]} */
        const offsetChanges = new Array(this.cycleMotions.length);
        for (let i = 0; i < this.cycleMotions.length; i++) offsets[i] = 0;

        const springs = (this.cycleMotions.length * this.cycleMotions.length - this.cycleMotions.length) / 2;
        let iteration = 0;
        let finished = false;
        while (iteration < 100 && finished == false) {
            for (let i = 0; i < this.cycleMotions.length; i++) offsetChanges[i] = 0;

            // Calculate offset changes
            for (let i = 1; i < this.cycleMotions.length; i++) {
                for (let j = 0; j < i; j++) {
                    for (let leg = 0; leg < this.legs.length; leg++) {
                        const ta = this.cycleMotions[i].cycles[leg].stanceTime + offsets[i];
                        const tb = this.cycleMotions[j].cycles[leg].stanceTime + offsets[j];
                        const va = new Vector2(Math.cos(ta * 2 * Math.PI), Math.sin(ta * 2 * Math.PI));
                        const vb = new Vector2(Math.cos(tb * 2 * Math.PI), Math.sin(tb * 2 * Math.PI));
                        const abVector = vb.clone().sub(va);
                        const va2 = va.clone().add(abVector.clone().multiplyScalar(0.1));
                        const vb2 = vb.clone().sub(abVector.clone().multiplyScalar(0.1));
                        const ta2 = Util.Mod(Math.atan2(va2.y, va2.x) / 2 / Math.PI);
                        const tb2 = Util.Mod(Math.atan2(vb2.y, vb2.x) / 2 / Math.PI);
                        let aChange = Util.Mod(ta2 - ta);
                        let bChange = Util.Mod(tb2 - tb);
                        if (aChange > 0.5) aChange = aChange - 1;
                        if (bChange > 0.5) bChange = bChange - 1;
                        offsetChanges[i] += aChange * 5.0 / springs;
                        offsetChanges[j] += bChange * 5.0 / springs;
                    }
                }
            }

            // Apply new offset changes
            let maxChange = 0;
            for (let i = 0; i < this.cycleMotions.length; i++) {
                offsets[i] += offsetChanges[i];
                maxChange = Math.max(maxChange, Math.abs(offsetChanges[i]));
            }

            iteration++;
            if (maxChange < 0.0001) finished = true;
        }

        // Apply the offsets to the motions
        for (let m = 0; m < this.cycleMotions.length; m++) {
            this.cycleMotions[m].cycleOffset = offsets[m];
            for (let leg = 0; leg < this.legs.length; leg++) {
                this.cycleMotions[m].cycles[leg].stanceTime =
                    Util.Mod(this.cycleMotions[m].cycles[leg].stanceTime + offsets[m]);
            }
        }
    }

}
