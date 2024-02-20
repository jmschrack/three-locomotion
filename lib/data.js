
import { Matrix4, Vector3 } from "three";

export class LegCycleData {
    constructor(){
        this.cycleCenter = new Vector3();
        this.cycleScaling = 0;
        this.cycleDirection = new Vector3();
        this.stanceTime = 0;
        this.liftTime = 0;
        this.liftoffTime = 0;
        this.postliftTime = 0;
        this.prelandTime = 0;
        this.strikeTime = 0;
        this.landTime = 0;
        this.cycleDistance = 0;
        this.stancePosition = new Vector3();
        this.heelToetipVector = new Vector3();
        /**@type {LegCycleSample[]} */
        this.samples = [];
        this.stanceIndex = 0;
        this.debugInfo = new CycleDebugInfo();
    
    }
	
}
export class CycleDebugInfo {
    constructor(){
        this.toeLiftTime = 0;
        this.toeLandTime = 0;
        this.ankleLiftTime = 0;
        this.ankleLandTime = 0;
        this.footLiftTime = 0;
        this.footLandTime = 0;
    
    }

}
/**
 * 
 * @param {Vector3} point 
 * @returns 
 */
function Empty(point){return point;}

export class LegCycleSample {
    constructor(){
        
        this.footBase = new Vector3();
        this.footBaseNormalized = new Vector3();
        this.heel = new Vector3();
        this.toetip = new Vector3();
        this.middle = new Vector3();
        this.ankle_name="";
        this.toe_name="";
        this.heel_raw=new Vector3();
        this.heel_world=new Vector3();
        this.toetip_raw=new Vector3();
        this.middle_raw=new Vector3();
        this.balance = 0;
        /**@type {Matrix4} */        
        this.ankleMatrix=null
        /**@type {Matrix4} */        
        this.toeMatrix=null
    }
	/* public Matrix4x4 ankleMatrix;
	public Vector3 heel;
	public Matrix4x4 toeMatrix;
	public Vector3 toetip;
	public Vector3 middle;
	public float balance;
	public Vector3 footBase;
	public Vector3 footBaseNormalized; */
}

export const MotionType ={
	WalkCycle:0,
	Grounded:1,
}