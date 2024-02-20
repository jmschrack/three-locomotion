import { MathUtils, Vector3 } from "three";
import { zero } from "./util";
import * as Util from "./util";

export class Interpolator {
	constructor(samplePoints){
        /**@type {number[][]} */
        this.samples = samplePoints;
    }
	
	
	// Method cannot be abstract since serilazation does not work well
	// with abstract classes
    /**
     * 
     * @param {number[]} output 
     * @param {boolean} normalize 
     */
	Interpolate( output,  normalize=true) {
		throw new Error("NotImplementedException");
	}
	
	// Returns the weights if simple cases are fulfilled.
	// Returns null otherwise.
    /**
     * 
     * @param {number[]} output 
     * @returns {number[]|null}
     */
	BasicChecks( output) {
		if (this.samples.length==1) {
			return [1];
		}
		for (let i=0; i<this.samples.length; i++) {
			if (Equals(output, this.samples[i])) {
				const weights = new Array(this.samples.length);//float[samples.length];
				weights[i] = 1;
				return weights;
			}
		}
		return null;
	}
	
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Distance( a,  b) {
    return Math.sqrt(SqrDistance(a,b));
}
/**
 * 
 * @param {number[]} a 
 * @returns 
 */
function Normalized( a) {
    return Multiply(a,1/Magnitude(a));
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Equals( a,b) {
    return (SqrDistance(a,b)==0);
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Angle(a, b) {
    let m = Magnitude(a) * Magnitude(b);
    if (m==0) return 0;
    return Math.acos( Math.max(-1,Math.min(Dot(a,b) / m,1 ) ) );
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function ClockwiseAngle(a, b) {
    let angle = Angle(a,b);
    if ((a[1]*b[0]-a[0]*b[1]) > 0) angle = 2*Math.PI - angle;
    return angle;
}
/**
 * 
 * @param {number[]} a 
 * @param {number} m 
 * @returns 
 */
function Multiply(a, m) {
    const sum = new Array(a.length);//float[a.Length];
    for (let i=0; i<a.length; i++) {
        sum[i] = a[i]*m;
    }
    return sum;
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Subtract( a, b) { return Add(a,Multiply(b,-1)); }
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Dot( a, b) {
    let product = 0.0;
    for (let i=0; i<a.length; i++) {
        product += a[i]*b[i];
    }
    return product;
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function Add( a,  b) {
    let sum = new Array(a.length)
    for (let i=0; i<a.length; i++) {
        sum[i] = a[i]+b[i];
    }
    return sum;
}
/**
 * 
 * @param {number[]} a 
 * @returns 
 */
function SqrMagnitude(a) {
    let result = 0.0;
    for (let i=0; i<a.length; i++) {
        result += Math.pow(a[i], 2);
    }
    return result;
}
/**
 * 
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
function SqrDistance( a,  b) {
    let sqrMagnitude = 0.0;
    for (let i=0; i<a.length; i++) {
        sqrMagnitude += Math.pow(a[i]-b[i], 2);
    }
    return sqrMagnitude;
}
/**
 * 
 * @param {number[]} a 
 * @returns 
 */
function Magnitude( a) {
    return Math.sqrt(SqrMagnitude(a));
}

export class PolarGradientBandInterpolator extends Interpolator {
	/**
     * 
     * @param {number[][]} samplePoints 
     */
	constructor( samplePoints)  {
        super(samplePoints);
		this.samples = samplePoints;
	}
	/**
     * 
     * @param {number[]} output 
     * @param {boolean} normalize 
     * @returns 
     */
	Interpolate(output, normalize=true) {
		let weights = this.BasicChecks(output);
		if (weights!=null) return weights;
		weights = new Array(this.samples.length);
		
		const outp=new Vector3();
        /**@type {Vector3[]} */
		const samp = new Array(this.samples.length);
		if (output.length==2) {
			outp.set(output[0],output[1],0); //= new Vector3(output[0],output[1],0);
			for (let i=0; i<this.samples.length; i++) {
				samp[i] = new Vector3(this.samples[i][0],this.samples[i][1],0);
			}
		}
		else if (output.length==3) {
			outp.set(output[0],output[1],output[2]); //= new Vector3(output[0],output[1],output[2]);
			for (let i=0; i<this.samples.length; i++) {
				samp[i] = new Vector3(this.samples[i][0],this.samples[i][1],this.samples[i][2]);
			}
		}
		else return null;
		
		for (let i=0; i<this.samples.length; i++) {
			let outsideHull = false;
			let value = 1;
			for (let j=0; j<this.samples.length; j++) {
				if (i==j) continue;
				
				const sampleI = samp[i];
				const sampleJ = samp[j];
				
				let iAngle, oAngle;
				const outputProj=new Vector3();
				let angleMultiplier = 2;
				if (sampleI.equals(zero()) ) {
					iAngle = outp.angleTo(sampleJ)
					oAngle = 0;
					outputProj.copy(outp);
					angleMultiplier = 1;
				}
				else if (sampleJ.equals(zero())) {
					iAngle = outp.angleTo(sampleI);
					oAngle = iAngle;
					outputProj.copy(outp);
					angleMultiplier = 1;
				}
				else {
					iAngle = sampleI.angleTo(sampleJ);
					if (iAngle>0) {
						if (outp.equals(zero())) {
							oAngle = iAngle;
							outputProj.copy(outp);
						}
						else {
							const axis =  sampleI.clone().cross(sampleJ);//Vector3.Cross(sampleI,sampleJ);
							Util.ProjectOntoPlane(outputProj.copy(outp),axis);// = Util.ProjectOntoPlane(outp,axis);
							oAngle = sampleI.angleTo(outputProj);
							if (iAngle<Math.PI*0.99) {
								if ( sampleI.clone().cross(outputProj).dot(axis)<0 ) {
									oAngle *= -1;
								}
							}
						}
					}
					else {
						outputProj.copy( outp);
						oAngle = 0;
					}
				}
				
				let magI = sampleI.length();
				let magJ = sampleJ.length();
				let magO = outputProj.length();
				let avgMag = (magI+magJ)/2;
				magI /= avgMag;
				magJ /= avgMag;
				magO /= avgMag;
				const vecIJ = new Vector3(iAngle*angleMultiplier, magJ-magI, 0);
				const vecIO = new Vector3(oAngle*angleMultiplier, magO-magI, 0);
				
				const newValue = 1-vecIJ.dot(vecIO)/vecIJ.lengthSq();   //Vector3.Dot(vecIJ,vecIO)/vecIJ.sqrMagnitude;
				
				if (newValue < 0) {
					outsideHull = true;
					break;
				}
				value = Math.min(value, newValue);
			}
			if (!outsideHull) weights[i] = value;
		}
		
		// Normalize weights
		if (normalize) {
			let summedWeight = 0;
			for (let i=0; i<this.samples.length; i++) summedWeight += weights[i];
			if (summedWeight > 0)
				for (let i=0; i<this.samples.length; i++) weights[i] /= summedWeight;
		}
		
		return weights;
	}
	
}
