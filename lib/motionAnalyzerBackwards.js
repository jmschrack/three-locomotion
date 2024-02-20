/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/
import * as Util from './util'
import { AnimationAction, AnimationMixer, AnimationClip, MathUtils, Object3D, Quaternion, Vector3, Color, ArrowHelper, Box3Helper, Box3 } from "three";
import { LegController } from "./locomotion";
import { LegCycleData, MotionType, LegCycleSample, CycleDebugInfo } from "./data";
import { GetRenderer } from './globals';



function clamp01(value) {
    return Math.min(1, Math.max(0, value));

}
/**
 * @property {string} name
 * @property {AnimationAction} animation
 * @property {MotionType} motionType
 * @property {string} motionGroup
 * @property {LegCycleData[]} cycles
 * @property {number} samples
 * @property {Vector3} cycleDirection
 * @property {number} cycleDistance
 * @property {Vector3} cycleVector
 * @property {number} cycleDuration
 * @property {number} cycleSpeed
 * @property {number} cycleOffset
 * @property {Vector3} cycleVelocity
 * @property {Function} GetFlightFootPosition
 */
export class IMotionAnalyzer {
    constructor(animation) {
        this.name = animation.getClip().name;
        /**@type {AnimationAction} */
        this.animation = animation;

        this.motionType = MotionType.WalkCycle;
        this.motionGroup = "locomotion";
        /**@type {LegCycleData[]} */
        this.m_cycles = null;
        this.m_cycleOffset = 0;


    }
    get cycles() { return this.m_cycles; }
    get cycleOffset() { return this.m_cycleOffset; }
    set cycleOffset(value) { this.m_cycleOffset = value; }
    get samples() { return 0; }
   /* get cycleDirection() { return undefined; }
    get cycleDistance() { return undefined; }
    get cycleDuration() { return undefined; }
    get cycleSpeed() { return undefined; }
    get cycleVelocity() { return undefined; }
    get cycleVector() { return undefined; } */
    
    /* [HideInInspector] public string name;
	
    public AnimationClip animation;
	
    public MotionType motionType = MotionType.WalkCycle;
	
    public string motionGroup = "locomotion";
	
    public abstract int samples { get; }
	
    public abstract LegCycleData[] cycles { get; }
	
    public abstract Vector3 cycleDirection { get; }
	
    public abstract float cycleDistance { get; }
	
    public abstract Vector3 cycleVector { get; }
	
    public abstract float cycleDuration { get; }
	
    public abstract float cycleSpeed { get; }
	
    public abstract Vector3 cycleVelocity { get; }
	
    public abstract Vector3 GetFlightFootPosition(int leg, float flightTime, int phase);
	
    public abstract float cycleOffset { get; set; }
	
    public abstract void Analyze(GameObject o); */
}

export class MotionAnalyzerBackwards extends IMotionAnalyzer {
    /**@type {AnimationAction} */
    constructor(animation) {
        super(animation)
        /**@type {MotionAnalyzer} */
        this.orig = null;
        this.m_cycles = null;
        this.m_cycleOffset = 0;

    }
    get cycles() { return this.m_cycles; }
    get samples() { return this.orig.samples; }
    get cycleDirection() { return this.orig.cycleDirection.clone().multiplyScalar(-1); }
    get cycleDistance() { return this.orig.cycleDistance; }
    get cycleVector() { return this.orig.cycleVector.clone().multiplyScalar(-1); }
    get cycleDuration() { return this.orig.cycleDuration; }
    get cycleSpeed() { return this.orig.cycleSpeed; }
    get cycleVelocity() { return this.orig.cycleVelocity.clone().multiplyScalar(-1); }
    get cycleOffset() { return this.m_cycleOffset; }
    /* public MotionAnalyzer orig;
	
    public LegCycleData[] m_cycles;
    public override LegCycleData[] cycles { get { return m_cycles; } }
	
    public override int samples { get { return orig.samples; } }
	
    public override Vector3 cycleDirection { get { return -orig.cycleDirection; } }
	
    public override float cycleDistance { get { return orig.cycleDistance; } }
	
    public override Vector3 cycleVector { get { return -orig.cycleVector; } }
	
    public override float cycleDuration { get { return orig.cycleDuration; } }
	
    public override float cycleSpeed { get { return orig.cycleSpeed; } }
	
    public override Vector3 cycleVelocity { get { return -orig.cycleVelocity; } }
	
    public float m_cycleOffset;
    public override float cycleOffset { get { return m_cycleOffset; } set { m_cycleOffset = value; } } */
    /**
     * 
     
     * @param {number} leg 
     * @param {number} flightTime 
     * @param {number} phase 
     * @returns 
     */
    GetFlightFootPosition(leg, flightTime, phase) {
        const origVector = this.orig.GetFlightFootPosition(leg, 1 - flightTime, 2 - phase);

        return new Vector3(1 * origVector.x, origVector.y, (1 - origVector.z));
    }
    /**
     * 
     * @param {LegController} legC 
     */
    Analyze(legC) {
        this.animation = this.orig.animation;
        this.name = this.animation.getClip().name + "_bk";
        this.motionType = this.orig.motionType;
        this.motionGroup = this.orig.motionGroup;

        // Initialize legs and cycle data
        //LegController legC = gameObject.GetComponent(typeof(LegController)) as LegController;
        const legs = legC.legs.length;
        /**@type {LegCycleData[]} */
        this.m_cycles = Array(legs);//new LegCycleData[legs];
        for (let leg = 0; leg < legs; leg++) {
            this.cycles[leg] = new LegCycleData();
            this.cycles[leg].cycleCenter = this.orig.cycles[leg].cycleCenter;
            this.cycles[leg].cycleScaling = this.orig.cycles[leg].cycleScaling;
            this.cycles[leg].cycleDirection = this.orig.cycles[leg].cycleDirection.clone().multiplyScalar(-1);
            this.cycles[leg].stanceTime = 1 - this.orig.cycles[leg].stanceTime;
            this.cycles[leg].liftTime = 1 - this.orig.cycles[leg].landTime;
            this.cycles[leg].liftoffTime = 1 - this.orig.cycles[leg].strikeTime;
            this.cycles[leg].postliftTime = 1 - this.orig.cycles[leg].prelandTime;
            this.cycles[leg].prelandTime = 1 - this.orig.cycles[leg].postliftTime;
            this.cycles[leg].strikeTime = 1 - this.orig.cycles[leg].liftoffTime;
            this.cycles[leg].landTime = 1 - this.orig.cycles[leg].liftTime;
            this.cycles[leg].cycleDistance = this.orig.cycles[leg].cycleDistance;
            this.cycles[leg].stancePosition = this.orig.cycles[leg].stancePosition;
            this.cycles[leg].heelToetipVector = this.orig.cycles[leg].heelToetipVector;
        }

    }

}

export class MotionAnalyzer extends IMotionAnalyzer {
    /**
     * 
     * @param {Object3D} object3D 
     * @param {AnimationAction} animation 
     */
    constructor(object3D, animation) {
        super(animation)
        /**@type {Object3D} */
        this.gameObject = object3D;
        this.alsoUseBackwards = false;
        this.fixFootSkating = false;
        /**@type {LegCycleData[]} */
        this.m_cycles = null;
        this.m_samples = 0;
        this.m_cycleDirection = new Vector3();
        this.m_cycleDistance = 0;
        this.m_cycleDuration = 0;
        this.m_cycleSpeed = 0;
        this.nativeSpeed = 0;
        this.m_cycleOffset = 0;
        this.graphMin = new Vector3();
        this.graphMax = new Vector3();
        /**@type {LegController} */
        this.legC = null;
        this.lineCache = {}
        this.diamondCache = {}
    }
    get cycles() { return this.m_cycles; }
    get samples() { return this.m_samples; }
    get cycleDirection() { return this.m_cycleDirection; }
    get cycleDistance() { return this.m_cycleDistance; }
    get cycleDuration() { return this.m_cycleDuration; }
    get cycleSpeed() { return this.m_cycleSpeed; }
    get cycleOffset() { return this.m_cycleOffset; }
    get cycleVelocity() { return this.m_cycleDirection.clone().multiplyScalar(this.m_cycleSpeed); }
    get cycleVector() { return this.m_cycleDirection.clone().multiplyScalar(this.m_cycleDistance); }


    /* public bool alsoUseBackwards = false;
	
    public bool fixFootSkating = false;
	
    [HideInInspector] public LegCycleData[] m_cycles;
    public override LegCycleData[] cycles { get { return m_cycles; } }
	
    [HideInInspector] public int m_samples;
    public override int samples { get { return m_samples; } }
	
    [HideInInspector] public Vector3 m_cycleDirection;
    public override Vector3 cycleDirection { get { return m_cycleDirection; } }
	
    [HideInInspector] public float m_cycleDistance;
    public override float cycleDistance { get { return m_cycleDistance; } }
	
    public override Vector3 cycleVector { get { return m_cycleDirection * m_cycleDistance; } }
	
    [HideInInspector] public float m_cycleDuration;
    public override float cycleDuration { get { return m_cycleDuration; } }
	
    [HideInInspector] public float m_cycleSpeed;
    public override float cycleSpeed { get { return m_cycleSpeed; } }
    public float nativeSpeed;
	
    public override Vector3 cycleVelocity { get { return m_cycleDirection * m_cycleSpeed; } }
	
    [HideInInspector] public float m_cycleOffset;
    public override float cycleOffset { get { return m_cycleOffset; } set { m_cycleOffset = value; } }
	
    [HideInInspector] public Vector3 graphMin;
    [HideInInspector] public Vector3 graphMax;
	
    // Convenience variables - do not show in inspector, even in debug mode
    [HideInInspector] public GameObject gameObject;
    [HideInInspector] public int legs;
    [HideInInspector] public LegController legC; */
    /**
     * 
     * @param {string} name 
     * @param {Vector3} start 
     * @param {Vector3} end 
     * @param {*} color 
     */
    DrawLine(name, start, end, color = 0xffffff) {

        this.DrawRay(name, start, end.clone().sub(start), color);
    }
    /**
     * 
     * @param {string} name 
     * @param {Vector3} origin 
     * @param {Vector3} direction 
     * @param {*} color 
     */
    DrawRay(name, origin, direction, color) {
        if (!this.lineCache[name]) {
            this.lineCache[name] = new ArrowHelper(direction, origin, 1, color, 0, 0);
        } else {
            /**@type {ArrowHelper} */
            const arrow = this.lineCache[name]
            arrow.setDirection(direction.clone().normalize());
            arrow.setLength(direction.length());
            arrow.position.copy(origin);
            arrow.setColor(color);
        }

    }
    /**
     * 
     * @param {Vector3} a 
     * @param {Number} size 
     * @param {Color} color 
     */
    DrawDiamond(name, a, size, color) {
        //Vector3 up = Camera.main.transform.up;
        const up = new Vector3(0, 1, 0);
        const right = new Vector3(-1, 0, 0);
        if (!this.diamondCache[name]) {
            const b = new Box3();
            b.setFromCenterAndSize(a, new Vector3(size, size, size));
            this.diamondCache[name] = new Box3Helper(b, color);
        } else {
            /**@type {Box3Helper} */
            const bh = this.diamondCache[name];
            bh.box.setFromCenterAndSize(a, new Vector3(size, size, size));
        }

    }
    RenderGraphAll(opt, currentLeg) {
        // Helper variables
        const l = currentLeg;
        const ankleT = this.legC.legs[l].ankle;
        const toeT = this.legC.legs[l].toe;
        const graphSpan = this.graphMax.clone().sub(this.graphMin);
        this.gameObject.updateWorldMatrix(true, false);
        const objectMatrix = this.gameObject.matrixWorld;

        // Time variables
        const time = Util.Mod(this.animation.time);//   gameObject.GetComponent<Animation>()[animation.name].normalizedTime);
        const cycleIndex = this.GetIndexFromTime(time);
        const timeRounded = this.GetTimeFromIndex(cycleIndex);
        // Colors

        const frameColor = new Color(0.7, 0.7, 0.7);
        const ankleColor = new Color(0.8, 0, 0);
        const toeColor = new Color(0, 0.7, 0);
        const strongColor = new Color(0, 0, 0);
        const weakColor = new Color(0.7, 0.7, 0.7);
        const strongClear = new Color(0.1, 0.1, 0.1);
        //strongClear.

        // Standard sizes
        const scale = this.gameObject.scale.z;
        const unit = this.cycleDistance * scale;
        const diamondSize = graphSpan.z * scale * 0.1;
        ankleT.updateWorldMatrix(true, false)
        const footHeel = ankleT.getWorldPosition(new Vector3(0, 0, 0)).add(Util.TransformVector(
            ankleT.matrixWorld, this.legC.legs[l].ankleHeelVector
        ));
        toeT.updateWorldMatrix(true, false);
        const footToetip = toeT.getWorldPosition(new Vector3()).add(Util.TransformVector(
            toeT.matrixWorld, this.legC.legs[l].toeToetipVector
        ));
        const footbaseHeel = this.cycles[l].samples[cycleIndex].footBase.clone().applyMatrix4(objectMatrix);
        const footbaseToetip = this.cycles[l].samples[cycleIndex].footBase.clone().add(this.cycles[l].heelToetipVector).applyMatrix4(objectMatrix);


        // Draw foot heel and toetip
        if (opt.drawHeelToe) {
            this.DrawDiamond("footHeel", footHeel, diamondSize, ankleColor);
            this.DrawDiamond("footToetip", footToetip, diamondSize, toeColor);
            //this.DrawDiamond('toetip',toeT.getWorldPosition(new Vector3()),diamondSize,0xffff00);
        }

        // Draw foot balanced base
        if (opt.drawFootBase) {
            this.DrawDiamond("footbaseHeel", footbaseHeel, diamondSize, strongClear);

            this.DrawDiamond("footbaseToetip", footbaseToetip, diamondSize, strongClear);

            this.DrawLine("footbaseHeel", footbaseHeel, footbaseToetip, strongColor);
        }

        // Draw foot trajectories
        for (let i = 0; i < this.samples * 2; i++) {
            const j = Util.Mod(cycleIndex - i, this.samples);
            const sA = this.cycles[l].samples[j];
            const sB = this.cycles[l].samples[Util.Mod(j - 1, this.samples)];

            const t1 = this.GetTimeFromIndex(i);
            const t2 = this.GetTimeFromIndex(i + 1);

            let driftA = 0;
            let driftB = 0;
            if (opt.normalizeGraph) {
                driftA = -t1 * this.cycleDistance;
                driftB = -t2 * this.cycleDistance;
            }

            const heelA = this.cycleDirection.clone().multiplyScalar(driftA).add(sA.heel).applyMatrix4(objectMatrix);//objectMatrix.MultiplyPoint3x4(sA.heel+driftA*cycleDirection);
            const heelB = this.cycleDirection.clone().multiplyScalar(driftB).add(sB.heel).applyMatrix4(objectMatrix) //objectMatrix.MultiplyPoint3x4(sB.heel+driftB*cycleDirection);
            const toetipA = this.cycleDirection.clone().multiplyScalar(driftA).add(sA.toetip).applyMatrix4(objectMatrix);//objectMatrix.MultiplyPoint3x4(sA.toetip+driftA*cycleDirection);
            const toetipB = this.cycleDirection.clone().multiplyScalar(driftB).add(sB.toetip).applyMatrix4(objectMatrix)//objectMatrix.MultiplyPoint3x4(sB.toetip+driftB*cycleDirection);
            const baseA = this.cycleDirection.clone().multiplyScalar(driftA).add(sA.footBase).applyMatrix4(objectMatrix)//objectMatrix.MultiplyPoint3x4(sA.footBase+driftA*cycleDirection);
            const baseB = this.cycleDirection.clone().multiplyScalar(driftB).add(sB.footBase).applyMatrix4(objectMatrix)//objectMatrix.MultiplyPoint3x4(sB.footBase+driftB*cycleDirection);//
            if (opt.drawHeelToe) {
                this.DrawLine(`heel_${currentLeg}_${i}`, heelA, heelB, ankleColor);
                this.DrawLine(`toe_${currentLeg}_${i}`, toetipA, toetipB, toeColor);
            }
            if (opt.drawFootBase) {
                this.DrawLine(`footBase_${currentLeg}_${i}`, baseA, baseB, ((j % 2 == 0) ? strongColor : weakColor));
            }

            if (opt.drawTrajectoriesProjected) {
                // Draw foot center trajectory projected onto ground plane
                this.DrawLine(`footCenter_${currentLeg}_${i}`,


                    Util.ProjectOntoPlane(sA.heel.clone().add(sA.toetip), new Vector3(0, 1, 0)).divideScalar(2)
                        .add(new Vector3(0, this.legC.groundPlaneHeight - graphSpan.y, 0)).applyMatrix4(objectMatrix)
                    ,
                    Util.ProjectOntoPlane(sB.heel.clone().add(sB.toetip), new Vector3(0, 1, 0)).divideScalar(2).add(new Vector3(0, this.legC.groundPlaneHeight - graphSpan.y, 0)).applyMatrix4(objectMatrix)
                    ,
                    strongColor
                );
            }
        }
    }

    /**
     * 
     
     * @param {LegCycleData} data 
     
     * @param {boolean} useToe 
     
     * @param {number} searchDirection 
     
     * @param {number} yRange 
     
     * @param {number} threshold 
     * @returns {number}
     */
    FindContactTime(data, useToe, searchDirection, yRange, threshold) {
        //console.log(`FindContactTime::useToe:${useToe},searchDirection:${searchDirection},yRange:${yRange},threshold:${threshold}`)
        //console.log("FindContactTime::",data);
        // Find the contact time on the height curve, where the (projected ankle or toe)
        // hits or leaves the ground (depending on search direction in time).
        const spread = 5; // FIXME magic number for spread value
        let curvatureMax = 0;
        let curvatureMaxIndex = data.stanceIndex;
        for (let i = 0; i < this.samples && i > -1 * this.samples; i += searchDirection) {
            // Find second derived by sampling three positions on curve.
            // Spred samples a bit to ignore high frequency noise.
            // FIXME magic number for spread value
            const j = new Array(3);//new int[3];
            const value = new Array(3);//new float[3];
            for (let s = 0; s < 3; s++) {
                j[s] = Util.Mod(i + data.stanceIndex - spread + spread * s, this.samples);
                if (useToe) value[s] = data.samples[j[s]].toetip.y;
                else value[s] = data.samples[j[s]].heel.y;
            }
            //float curvatureCurrent = value[0]+value[2]-2*value[1];
            const curvatureCurrent = Math.atan((value[2] - value[1]) * 10 / yRange) - Math.atan((value[1] - value[0]) * 10 / yRange);
            if (
                // Sample must be above the ground
                (value[1] > this.legC.groundPlaneHeight)
                // Sample must have highest curvature
                && (curvatureCurrent > curvatureMax)
                // Slope at sample must go upwards (when going in search direction)
                && (Math.sign(value[2] - value[0]) == Math.sign(searchDirection))
            ) {
                curvatureMax = curvatureCurrent;
                curvatureMaxIndex = j[1];
            }
            // Terminate search when foot height is above threshold height above ground
            if (value[1] > this.legC.groundPlaneHeight + yRange * threshold) {
                break;
            }
        }
        return this.GetTimeFromIndex(Util.Mod(curvatureMaxIndex - data.stanceIndex, this.samples));
    }
    /**
     * 
     
     * @param {LegCycleData} data 
     
     * @param {Number} searchDirection 
     
     * @param {Number} threshold 
     * @returns {Number}
     */
    FindSwingChangeTime(data, searchDirection, threshold) {
        // Find the contact time on the height curve, where the (projected ankle or toe)
        // hits or leaves the ground (depending on search direction in time).
        const spread = this.samples / 5; // FIXME magic number for spread value
        let stanceSpeed = 0;
        for (let i = 0; i < this.samples && i > -1 * this.samples; i += searchDirection) {
            // Find speed by sampling curve value ahead and behind.
            const j = new Array(3);// int[3];
            const value = new Array(3);// float[3];
            for (let s = 0; s < 3; s++) {
                j[s] = Util.Mod(i + data.stanceIndex - spread + spread * s, this.samples);
                value[s] = data.samples[j[s]].footBase.clone().dot(data.cycleDirection) //Vector3.Dot(data.samples[j[s]].footBase, data.cycleDirection);
            }
            const currentSpeed = value[2] - value[0];
            if (i == 0) stanceSpeed = currentSpeed;
            // If speed is too different from speed at stance time,
            // the current time is determined as the swing change time
            if (Math.abs((currentSpeed - stanceSpeed) / stanceSpeed) > threshold) {
                return this.GetTimeFromIndex(Util.Mod(j[1] - data.stanceIndex, this.samples));
            }
        }
        return Util.Mod(searchDirection * -0.01);
    }
    /**
     * 
     * @param {number} leg 
     * @param {number} time 
     * @returns {number}
     */
    GetFootGrounding(leg, time) {
        if ((time <= this.cycles[leg].liftTime) || (time >= this.cycles[leg].landTime)) return 0;
        if ((time >= this.cycles[leg].postliftTime) && (time <= this.cycles[leg].prelandTime)) return 1;
        let val;
        if (time < this.cycles[leg].postliftTime) {
            val = (time - this.cycles[leg].liftTime) / (this.cycles[leg].postliftTime - this.cycles[leg].liftTime);
        }
        else {
            val = 1 - (time - this.cycles[leg].prelandTime) / (this.cycles[leg].landTime - this.cycles[leg].prelandTime);
        }
        return val;
    }
    /**
     * 
     * @param {number} leg 
     * @param {number} time 
     * @returns 
     */
    GetFootGroundingOrig(leg, time) {
        if ((time <= this.cycles[leg].liftTime) || (time >= this.cycles[leg].landTime)) return 0;
        if ((time >= this.cycles[leg].liftoffTime) && (time <= this.cycles[leg].strikeTime)) return 1;
        let val;
        if (time < this.cycles[leg].liftoffTime) {
            val = (time - this.cycles[leg].liftTime) / (this.cycles[leg].liftoffTime - this.cycles[leg].liftTime);
        }
        else {
            val = 1 - (time - this.cycles[leg].strikeTime) / (this.cycles[leg].landTime - this.cycles[leg].strikeTime);
        }
        return val;
    }
    /**
     * 
     * @param {number} time 
     * @returns 
     */
    GetIndexFromTime(time) {
        return Util.Mod(Math.trunc(time * this.samples + 0.5), this.samples);
    }
    /**
     * 
     * @param {number} index 
     * @returns 
     */
    GetTimeFromIndex(index) {
        return index * 1.0 / this.samples;
    }

    /* private delegate Vector3 GetVector3Member(LegCycleSample s);
    private delegate float GetFloatMember(LegCycleSample s);
    private Vector3 FootPositionNormalized(LegCycleSample s) { return s.footBaseNormalized; }
    private Vector3 FootPosition(LegCycleSample s) { return s.footBase; }
    private float Balance(LegCycleSample s) { return s.balance; } */
    /**
     * @typedef {Function} GetVector3Member
     * @param {LegCycleSample} s
     * @returns {Vector3}
     */
    /**
     * @typedef {Function} GetFloatMember
     * @param {LegCycleSample} s
     * @returns {number}
     */
    /**
     * 
     * @param {number} leg 
     * @param {number} flightTime 
     * @param {GetVector3Member} get 
     * @returns 
     */
    GetVector3AtTime(leg, flightTime, get) {

        flightTime = clamp01(flightTime);
        let index = Math.trunc(flightTime * this.samples);
        let weight = flightTime * this.samples - index;
        if (index >= this.samples - 1) {
            index = this.samples - 1;
            weight = 0;
        }
        index = Util.Mod(index + this.cycles[leg].stanceIndex, this.samples);
        return (
            get(this.cycles[leg].samples[index]) * (1 - weight)
            + get(this.cycles[leg].samples[Util.Mod(index + 1, this.samples)]) * (weight)
        );
    }
    /**
     * 
     * @param {number} leg 
     * @param {number} flightTime 
     * @param {GetFloatMember} get 
     * @returns 
     */
    GetFloatAtTime(leg, flightTime, get) {
        flightTime = clamp01(flightTime);
        let index = Math.trunc(flightTime * this.samples);
        let weight = flightTime * this.samples - index;
        if (index >= this.samples - 1) {
            index = this.samples - 1;
            weight = 0;
        }
        index = Util.Mod(index + this.cycles[leg].stanceIndex, this.samples);
        return (
            get(this.cycles[leg].samples[index]) * (1 - weight)
            + get(this.cycles[leg].samples[Util.Mod(index + 1, this.samples)]) * (weight)
        );
    }
    /**
     * 
     * @param {number} leg 
     * @param {number} flightTime 
     * @param {number} phase 
     * @returns {Vector3}
     */
    GetFlightFootPosition(leg, flightTime, phase) {
        if (this.motionType != MotionType.WalkCycle) {
            if (phase == 0) return Util.zero();
            if (phase == 1) return Util.forward().multiplyScalar(-1 * Math.cos(flightTime * Math.PI) / 2 + 0.5);
            if (phase == 2) return Util.forward();
        }

        let cycleTime = 0;
        if (phase == 0) cycleTime = MathUtils.lerp(0, this.cycles[leg].liftoffTime, flightTime);
        else if (phase == 1) cycleTime = MathUtils.lerp(this.cycles[leg].liftoffTime, this.cycles[leg].strikeTime, flightTime);
        else cycleTime = MathUtils.lerp(this.cycles[leg].strikeTime, 1, flightTime);
        //return GetVector3AtTime(leg,cycleTime,FootPositionNormalized);
        //flightTime = Math.clamp01(flightTime);
        let index = Math.trunc(cycleTime * this.samples);
        let weight = cycleTime * this.samples - index;
        if (index >= this.samples - 1) {
            index = this.samples - 1;
            weight = 0;
        }
        index = Util.Mod(index + this.cycles[leg].stanceIndex, this.samples);
        return this.cycles[leg].samples[index].footBaseNormalized.clone().multiplyScalar(1 - weight).add(this.cycles[leg].samples[index].footBaseNormalized.clone().multiplyScalar(weight))

    }



    /**
     * 
     * @param {number} leg 
     */
    FindCycleAxis(leg) {
        // Find axis that feet are moving back and forth along
        // (i.e. Z for characters facing Z, that are walking forward, but could be any direction)
        // FIXME
        // First find the average point of all the points in the foot motion curve
        // (projeted onto the ground plane). This gives us a center.
       
        this.cycles[leg].cycleCenter = Util.zero();
        for (let i = 0; i < this.samples; i++) {
            const s = this.cycles[leg].samples[i];
            // FIXME: Assumes horizontal ground plane
            this.cycles[leg].cycleCenter.add(Util.ProjectOntoPlane(s.middle.clone(), Util.up()));
        }
        this.cycles[leg].cycleCenter.divideScalar(this.samples);
        console.log(`${this.name} FindCycleAxis::leg:${leg} Heel::${this.cycles[leg].samples[0].heel.toArray().join(",")} Toe:${this.cycles[leg].samples[0].toetip.toArray().join(',')} Middle:${this.cycles[leg].samples[0].middle.toArray().join(',')}`)
        let maxlength;
        // Then find the point furthest away from this center point
        let footCurvePointA = this.cycles[leg].cycleCenter;
        maxlength = 0.0;
        for (let i = 0; i < this.samples; i++) {
            const s = this.cycles[leg].samples[i];
            // TODO: Assumes horizontal ground plane
            const curvePoint = Util.ProjectOntoPlane(s.middle.clone(), Util.up());
            const curLength = curvePoint.clone().sub(this.cycles[leg].cycleCenter).length();
            if (curLength > maxlength) {
                footCurvePointA = curvePoint;
                maxlength = curLength;
            }
        }

        // Lastly find the point furthest away from the point we found before
        let footCurvePointB = footCurvePointA;
        maxlength = 0.0;
        for (let i = 0; i < this.samples; i++) {
            const s = this.cycles[leg].samples[i];
            // TODO: Assumes horizontal ground plane
            const curvePoint = Util.ProjectOntoPlane(s.middle.clone(), Util.up());
            const curLength = curvePoint.clone().sub(footCurvePointA).length();
            if (curLength > maxlength) {
                footCurvePointB = curvePoint;
                maxlength = curLength;
            }
        }

        this.cycles[leg].cycleDirection = footCurvePointB.clone().sub(footCurvePointA).normalize()
        this.cycles[leg].cycleScaling = footCurvePointB.length();
    }
    /**
     * 
     * @param {LegController} legC
     * @param {Object3D} gameObject 
     */
    Analyze(legC,gameObject) {
        console.log("Starting analysis");


        //this.name = this.animation.getClip().name;
        this.m_samples = 50;

        // Initialize legs and cycle data
        //legC = gameObject.GetComponent(typeof(LegController)) as LegController;
        this.legs = legC.legs.length;
        this.m_cycles = new Array(this.legs);//LegCycleData[legs];
        for (let leg = 0; leg < this.legs; leg++) {
            this.cycles[leg] = new LegCycleData();
            this.cycles[leg].samples = new Array(this.samples + 1)//new LegCycleSample[samples+1];
            for (let i = 0; i < this.samples + 1; i++) {
                this.cycles[leg].samples[i] = new LegCycleSample();
            }
            this.cycles[leg].debugInfo = new CycleDebugInfo();
        }

        this.graphMin = new Vector3(0, 1000, 1000);
        this.graphMax = new Vector3(0, -1000, -1000);

        for (let leg = 0; leg < this.legs; leg++) {
            // Sample ankle, heel, toe, and toetip positions over the length of the animation.
            const ankleT = legC.legs[leg].ankle;
            const toeT = legC.legs[leg].toe;

            let rangeMax = 0;
            let ankleMin, ankleMax, toeMin, toeMax;
            ankleMin = 1000;
            ankleMax = -1000;
            toeMin = 1000;
            toeMax = -1000;
            for (let i = 0; i < this.samples + 1; i++) {
                const s = this.cycles[leg].samples[i];

                Util.SampleAnimation(this.animation, i * 1.0 / this.samples * this.animation.getClip().duration);
                gameObject.updateWorldMatrix(true, true);
                (GetRenderer())();
                s.ankleMatrix = Util.RelativeMatrix(ankleT, gameObject);
                s.toeMatrix = Util.RelativeMatrix(toeT, gameObject);
                s.ankle_name = ankleT.name;
                s.toe_name = toeT.name;
                //console.log("ankleHeelVector before matrix",legC.legs[leg].ankleHeelVector.toArray().join(','));
                s.heel_raw = legC.legs[leg].ankleHeelVector.clone();
               // s.heel_world = ankleT.localToWorld(legC.legs[leg].ankleHeelVector.clone());;
                s.heel =legC.legs[leg].ankleHeelVector.clone().applyMatrix4( s.ankleMatrix)//this.gameObject.worldToLocal(ankleT.localToWorld(legC.legs[leg].ankleHeelVector.clone()))
                //s.heel = legC.legs[leg].ankleHeelVector.clone().applyMatrix4(s.ankleMatrix);//s.ankleMatrix(legC.legs[leg].ankleHeelVector);
                //console.log("ankleHeelVector after matrix",legC.legs[leg].ankleHeelVector.toArray().join(','));
                s.toetip_raw = legC.legs[leg].toeToetipVector.clone();
                s.toetip = legC.legs[leg].toeToetipVector.clone().applyMatrix4(s.toeMatrix)//s.toeMatrix(legC.legs[leg].toeToetipVector);

                s.middle = s.heel.clone().add(s.toetip).divideScalar(2)
                /* if(s.heel.toArray().some(n=>Number.isNaN(n))){
                    console.error(`Found NaN in heel ${leg}`,JSON.stringify(legC.legs[leg],(k,v)=>{if(k.includes('Chain')) return undefined; else return v;}));
                    throw new Error("Invalid heel");
                } */
                // For each sample in time we want to know if the heel or toetip is closer to the ground.
                // We need a smooth curve with 0 = ankle is closer and 1 = toe is closer.
                s.balance = GetFootBalance(s.heel.y, s.toetip.y, legC.legs[leg].footLength);

                // Find the minimum and maximum extends on all axes of the ankle and toe positions.
                ankleMin = Math.min(ankleMin, s.heel.y);
                toeMin = Math.min(toeMin, s.toetip.y);
                ankleMax = Math.max(ankleMax, s.heel.y);
                toeMax = Math.max(toeMax, s.toetip.y);
            }
            rangeMax = Math.max(ankleMax - ankleMin, toeMax - toeMin);
            console.log("Samples", this.cycles[leg].samples)
            // Determine motion type
            /*if (motionType==MotionType.AutoDetect) {
                motionType = MotionType.WalkCycle;
            }*/

            if (this.motionType == MotionType.WalkCycle) {
                this.FindCycleAxis(leg);

                // Foot stance time
                // Find the time when the foot stands most firmly on the ground.
                let stanceValue = Number.POSITIVE_INFINITY;
                for (let i = 0; i < this.samples + 1; i++) {
                    const s = this.cycles[leg].samples[i];

                    let sampleValue =
                        // We want the point in time when the max of the heel height and the toe height is lowest
                        Math.max(s.heel.y, s.toetip.y) / rangeMax
                        // Add some bias to poses where the leg is in the middle of the swing
                        // i.e. the foot position is close to the middle of the foot curve
                        + Math.abs(
                            Util.ProjectOntoPlane(s.middle.clone().sub(this.cycles[leg].cycleCenter), new Vector3(0, 1, 0)).length()
                        ) / this.cycles[leg].cycleScaling;

                    // Use the new value if it is lower (better).
                    if (sampleValue < stanceValue) {
                        this.cycles[leg].stanceIndex = i;
                        stanceValue = sampleValue;
                    }
                }
            }
            else {
                this.cycles[leg].cycleDirection = new Vector3(0, 0, 1);//Vector3.forward
                this.cycles[leg].cycleScaling = 0;
                this.cycles[leg].stanceIndex = 0;
            }
            // The stance time
            this.cycles[leg].stanceTime = this.GetTimeFromIndex(this.cycles[leg].stanceIndex);

            // The stance index sample
            const ss = this.cycles[leg].samples[this.cycles[leg].stanceIndex];
            // Sample the animation at stance time
            Util.SampleAnimation(this.animation, this.cycles[leg].stanceTime * this.animation.getClip().duration);
            this.gameObject.updateWorldMatrix(true, true);
            (GetRenderer())();
            // Using the stance sample as reference we can now determine:

            // The vector from heel to toetip at the stance pose 
            /*
            cycles[leg].heelToetipVector = (
                ss.toeMatrix.MultiplyPoint(legC.legs[leg].toeToetipVector)
                - ss.ankleMatrix.MultiplyPoint(legC.legs[leg].ankleHeelVector)
            );
            */
            this.cycles[leg].heelToetipVector = (
                this.legC.legs[leg].toeToetipVector.clone().applyMatrix4(ss.toeMatrix)
                    .sub(
                        this.legC.legs[leg].ankleHeelVector.clone().applyMatrix4(ss.ankleMatrix)
                    )
            )
            //console.log(`heelToeTipVector ${leg} step0 toeToetipVector:${this.legC.legs[leg].toeToetipVector.toArray().join(',')} =>${this.legC.legs[leg].toeToetipVector.clone().applyMatrix4(ss.toeMatrix).toArray().join(',')} ankleHeelVector:${this.legC.legs[leg].ankleHeelVector.toArray().join(',')} => ${this.legC.legs[leg].ankleHeelVector.clone().applyMatrix4(ss.ankleMatrix).toArray().join(',')}`)
            //console.log(`heelToetipVector ${leg} step1`, this.cycles[leg].heelToetipVector.toArray().join(','));
            this.cycles[leg].heelToetipVector = Util.ProjectOntoPlane(this.cycles[leg].heelToetipVector.clone(), new Vector3(0, 1, 0));
            //console.log(`heelToetipVector ${leg} step2`, this.cycles[leg].heelToetipVector.toArray().join(','));
            this.cycles[leg].heelToetipVector = this.cycles[leg].heelToetipVector.clone().normalize().multiplyScalar(legC.legs[leg].footLength);
            //console.log(`heelToetipVector ${leg} step3`, this.cycles[leg].heelToetipVector.toArray().join(','));

            // Calculate foot flight path based on weighted average between ankle flight path and toe flight path,
            // using foot balance as weight.
            // The distance between ankle and toe is accounted for, using the stance pose for reference.
            for (let i = 0; i < this.samples + 1; i++) {
                const s = this.cycles[leg].samples[i];
                s.footBase = s.heel.clone().multiplyScalar(1 - s.balance).add(
                    s.toetip.clone().sub(this.cycles[leg].heelToetipVector).multiplyScalar(s.balance)
                )
                
            }

            // The position of the footbase in the stance pose
            this.cycles[leg].stancePosition = ss.footBase;
            this.cycles[leg].stancePosition.y = legC.groundPlaneHeight;

            if (this.motionType == MotionType.WalkCycle) {
                // Find contact times:
                // Strike time: foot first touches the ground (0% grounding)
                // Down time: all of the foot touches the ground (100% grounding)
                // Lift time: all of the foot still touches the ground but begins to lift (100% grounding)
                // Liftoff time: last part of the foot leaves the ground (0% grounding)
                let timeA;
                let timeB;

                // Find upwards contact times for projected ankle and toe
                // Use the first occurance as lift time and the second as liftoff time
                timeA = this.FindContactTime(this.cycles[leg], false, +1, rangeMax, 0.1);
                this.cycles[leg].debugInfo.ankleLiftTime = timeA;
                timeB = this.FindContactTime(this.cycles[leg], true, +1, rangeMax, 0.1);
                //console.log("Contact time A and B ",timeA,timeB)
                this.cycles[leg].debugInfo.toeLiftTime = timeB;
                if (timeA < timeB) {
                    this.cycles[leg].liftTime = timeA;
                    this.cycles[leg].liftoffTime = timeB;
                }
                else {
                    this.cycles[leg].liftTime = timeB;
                    this.cycles[leg].liftoffTime = timeA;
                }

                // Find time where swing direction and speed changes significantly.
                // If this happens sooner than the found liftoff time,
                // then the liftoff time must be overwritten with this value.
                timeA = this.FindSwingChangeTime(this.cycles[leg], 1, 0.5);
                this.cycles[leg].debugInfo.footLiftTime = timeA;
                if (this.cycles[leg].liftoffTime > timeA) {
                    this.cycles[leg].liftoffTime = timeA;
                    if (this.cycles[leg].liftTime > this.cycles[leg].liftoffTime) {
                        this.cycles[leg].liftTime = this.cycles[leg].liftoffTime;
                    }
                }

                // Find downwards contact times for projected ankle and toe
                // Use the first occurance as strike time and the second as down time
                timeA = this.FindContactTime(this.cycles[leg], false, -1, rangeMax, 0.1);
                timeB = this.FindContactTime(this.cycles[leg], true, -1, rangeMax, 0.1);
                if (timeA < timeB) {
                    this.cycles[leg].strikeTime = timeA;
                    this.cycles[leg].landTime = timeB;
                }
                else {
                    this.cycles[leg].strikeTime = timeB;
                    this.cycles[leg].landTime = timeA;
                }

                // Find time where swing direction and speed changes significantly.
                // If this happens later than the found strike time,
                // then the strike time must be overwritten with this value.
                timeA = this.FindSwingChangeTime(this.cycles[leg], -1, 0.5);
                this.cycles[leg].debugInfo.footLandTime = timeA;
                if (this.cycles[leg].strikeTime < timeA) {
                    this.cycles[leg].strikeTime = timeA;
                    if (this.cycles[leg].landTime < this.cycles[leg].strikeTime) {
                        this.cycles[leg].landTime = this.cycles[leg].strikeTime;
                    }
                }

                // Set postliftTime and prelandTime
                const softening = 0.2;

                this.cycles[leg].postliftTime = this.cycles[leg].liftoffTime;
                if (this.cycles[leg].postliftTime < this.cycles[leg].liftTime + softening) {
                    this.cycles[leg].postliftTime = this.cycles[leg].liftTime + softening;
                }

                this.cycles[leg].prelandTime = this.cycles[leg].strikeTime;
                if (this.cycles[leg].prelandTime > this.cycles[leg].landTime - softening) {
                    this.cycles[leg].prelandTime = this.cycles[leg].landTime - softening;
                }

                // Calculate the distance traveled during one cycle (for this foot).
                const stanceSlideVector = (
                    this.cycles[leg].samples[this.GetIndexFromTime(Util.Mod(this.cycles[leg].liftoffTime + this.cycles[leg].stanceTime))].footBase.clone()
                        .sub(
                            this.cycles[leg].samples[this.GetIndexFromTime(Util.Mod(this.cycles[leg].strikeTime + this.cycles[leg].stanceTime))].footBase
                        )
                );
                // FIXME: Assumes horizontal ground plane
                stanceSlideVector.y = 0;
                this.cycles[leg].cycleDistance = stanceSlideVector.length() / (this.cycles[leg].liftoffTime - this.cycles[leg].strikeTime + 1);
                this.cycles[leg].cycleDirection = stanceSlideVector.clone().normalize().multiplyScalar(-1)
                // console.log("Stance slide vector "+ stanceSlideVector.toArray().join(',')+ " based on liftoffTime "+this.cycles[leg].liftoffTime+" and strikeTime "+this.cycles[leg].strikeTime);
            }
            else {
                this.cycles[leg].cycleDirection = new Vector3(0, 0, 0);
                this.cycles[leg].cycleDistance = 0;
            }

            this.graphMax.y = Math.max(this.graphMax.y, Math.max(ankleMax, toeMax));
        }

        // Find the overall speed and direction traveled during one cycle,
        // based on average of speed values for each individual foot.
        // (They should be very close, but animations are often imperfect,
        // leading to different speeds for different legs.)
        this.m_cycleDistance = 0;
        this.m_cycleDirection = new Vector3(0, 0, 0);
        for (let leg = 0; leg < this.legs; leg++) {
            this.m_cycleDistance += this.cycles[leg].cycleDistance;
            this.m_cycleDirection.add(this.cycles[leg].cycleDirection);
            console.log("Cycle direction of leg " + leg + " is " + this.cycles[leg].cycleDirection.toArray().join(',') + " with step distance " + this.cycles[leg].cycleDistance);
        }

        this.m_cycleDistance /= this.legs;
        this.m_cycleDirection.divideScalar(this.legs);
        this.m_cycleDuration = this.animation.getClip().duration;
        this.m_cycleSpeed = this.cycleDistance / this.cycleDuration;
        console.log("Overall cycle direction is " + this.m_cycleDirection + " with step distance " + this.m_cycleDistance + " and speed " + this.m_cycleSpeed + " and duration " + this.m_cycleDuration);
        this.nativeSpeed = this.m_cycleSpeed * this.gameObject.scale.x;

        // Calculate normalized foot flight path
        for (let leg = 0; leg < this.legs; leg++) {
            if (this.motionType == MotionType.WalkCycle) {
                for (let j = 0; j < this.samples; j++) {
                    const i = Util.Mod(j + this.cycles[leg].stanceIndex, this.samples);
                    const s = this.cycles[leg].samples[i];
                    const time = this.GetTimeFromIndex(j);
                    s.footBaseNormalized = s.footBase.clone();
                    if (legC.legs.some(l => l.ankleHeelVector.toArray().some(n => Number.isNaN(n)))) {
                        throw new Error("Invalid ankleHeelVector corruption");
                    }
                    if (this.fixFootSkating) {
                        // Calculate normalized foot flight path
                        // based on the calculated cycle distance of each individual foot
                        const reference =
                            this.cycles[leg].cycleDirection.clone().multiplyScalar(time - this.cycles[leg].liftoffTime).multiplyScalar(-1 * this.cycles[leg].cycleDistance).add(
                                this.cycles[leg].samples[
                                    this.GetIndexFromTime(this.cycles[leg].liftoffTime + this.cycles[leg].stanceTime)
                                ].footBase);


                        s.footBaseNormalized.sub(reference)
                        if (!this.cycles[leg].cycleDirection.equals(new Vector3(0, 0, 0))) {
                            s.footBaseNormalized.applyQuaternion(Util.LookRotation(this.cycles[leg].cycleDirection, Util.up()).invert());
                        }

                        s.footBaseNormalized.z /= (this.cycles[leg].cycleDistance);
                        if (time <= this.cycles[leg].liftoffTime) { s.footBaseNormalized.z = 0; }
                        if (time >= this.cycles[leg].strikeTime) { s.footBaseNormalized.z = 1; }

                        s.footBaseNormalized.y = s.footBase.y - legC.groundPlaneHeight;
                    }
                    else {
                        // Calculate normalized foot flight path
                        // based on the cycle distance of the whole motion
                        // (the calculated average cycle distance)
                        const reference = (this.m_cycleDirection.clone().multiplyScalar(-1 * this.m_cycleDistance * time).add(this.cycles[leg].samples[this.GetIndexFromTime(this.cycles[leg].stanceTime)].footBase));
                        if (legC.legs.some(l => l.ankleHeelVector.toArray().some(n => Number.isNaN(n)))) {
                            throw new Error("Invalid ankleHeelVector corruption after reference");
                        }


                        s.footBaseNormalized.sub(reference);
                        if (!this.cycles[leg].cycleDirection.equals(Util.zero())) {
                            s.footBaseNormalized.applyQuaternion(Util.LookRotation(this.m_cycleDirection, Util.up()).invert())
                        }
                        if (legC.legs.some(l => l.ankleHeelVector.toArray().some(n => Number.isNaN(n)))) {
                            throw new Error("Invalid ankleHeelVector corruption after applying quaternion");
                        }
                        s.footBaseNormalized.z /= (this.m_cycleDistance);
                        if (legC.legs.some(l => l.ankleHeelVector.toArray().some(n => Number.isNaN(n)))) {
                            throw new Error(`Invalid ankleHeelVector corruption after dividing z by cycleDistance ${this.m_cycleDistance}`);
                        }
                        s.footBaseNormalized.y = s.footBase.y - legC.groundPlaneHeight;
                        if (legC.legs.some(l => l.ankleHeelVector.toArray().some(n => Number.isNaN(n)))) {
                            throw new Error("Invalid ankleHeelVector corruption after setting footBaseNormalized groundPlaneHeight");
                        }
                    }
                }
                //cycles[leg].samples[cycles[leg].stanceIndex].footBaseNormalized.z = 0;
                this.cycles[leg].samples[this.samples] = this.cycles[leg].samples[0];
            }
            else {
                for (let j = 0; j < this.samples; j++) {
                    const i = Util.Mod(j + this.cycles[leg].stanceIndex, this.samples);
                    const s = this.cycles[leg].samples[i];
                    s.footBaseNormalized = s.footBase.clone().sub(this.cycles[leg].stancePosition);
                }
            }
        }

        for (let leg = 0; leg < this.legs; leg++) {
            const heelToeZDist = this.cycles[leg].heelToetipVector.dot(this.cycleDirection);
            for (let i = 0; i < this.samples; i++) {
                const s = this.cycles[leg].samples[i];
                const zVal = s.footBase.dot(this.cycleDirection);
                if (zVal < this.graphMin.z) this.graphMin.z = zVal;
                if (zVal > this.graphMax.z) this.graphMax.z = zVal;
                if (zVal + heelToeZDist < this.graphMin.z) this.graphMin.z = zVal + heelToeZDist;
                if (zVal + heelToeZDist > this.graphMax.z) this.graphMax.z = zVal + heelToeZDist;
            }
        }

        this.graphMin.y = legC.groundPlaneHeight;
        for (let leg = 0; leg < this.legs; leg++) {
            console.log(this.cycles[leg].debugInfo);
        }
    }
}


/**
     * 
     
     * @param {Object3D} ankleT 
     * @param {Vector3} ankleHeelVector 
     * @param {Object3D} toeT 
     * @param {Vector3} toeToetipVector 
     * @param {Vector3} stanceFootVector 
     * @param {Quaternion} footBaseRotation 
     * @returns 
     */
export function GetHeelOffset(
    ankleT, ankleHeelVector,
    toeT, toeToetipVector,
    stanceFootVector,
    footBaseRotation
) {
    // Given the ankle and toe transforms,
    // the heel and toetip positions are calculated.
    const heel = ankleT.localToWorld(ankleHeelVector.clone())
    const toetip = toeT.localToWorld(toeToetipVector.clone());

    const footBaseRotationInverse = footBaseRotation.clone().invert();

    // From this the balance is calculated,
    // relative to the current orientation of the foot base.
    const balance = GetFootBalance(
        heel.clone().applyQuaternion(footBaseRotationInverse).y,
        toetip.clone().applyQuaternion(footBaseRotationInverse).y,
        stanceFootVector.length()
    );
    // From the balance, the heel offset can be calculated.
    return stanceFootVector.clone().applyQuaternion(footBaseRotation).add(heel).sub(toetip).multiplyScalar(balance);

}

/**
     * 
     
     * @param {Object3D} ankleT 
     
     * @param {Vector3} ankleHeelVector 
     
     * @param {Object3D} toeT 
     
     * @param {Vector3} toeToetipVector 
     
     * @param {Vector3} stanceFootVector 
     
     * @param {Vector3} footBasePosition 
     
     * @param {Quaternion} footBaseRotation 
     * @returns 
     */
export function GetAnklePosition(
    ankleT, ankleHeelVector,
    toeT, toeToetipVector,
    stanceFootVector,
    footBasePosition, footBaseRotation
) {
    // Get the heel offset
    const heelOffset = GetHeelOffset(
        ankleT, ankleHeelVector, toeT, toeToetipVector,
        stanceFootVector, footBaseRotation
    );
    // Then calculate the ankle position.
    return ankleT.localToWorld(ankleHeelVector.clone().multiplyScalar(-1)).add(heelOffset).add(footBasePosition);

}

/**
     * 
     * @param {number} heelElevation 
     * @param {number} toeElevation 
     * @param {number} footLength 
     * @returns 
     */
function GetFootBalance(heelElevation, toeElevation, footLength) {
    // For any moment in time we want to know if the heel or toe is closer to the ground.
    // Rather than a binary value, we need a smooth curve with 0 = heel is closer and 1 = toe is closer.
    // We use the inverse tangens for this as it maps arbritarily large positive or negative values into a -1 to 1 range.
    return Math.atan((
        // Difference in height between heel and toe.
        heelElevation - toeElevation
    ) / footLength * 20) / Math.PI + 0.5;
    // The 20 multiplier is found by trial and error. A rapid but still slightly smooth change of weight is wanted.
}