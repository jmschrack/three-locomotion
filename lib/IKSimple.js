/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/

import { MathUtils, Object3D, Quaternion, Vector3 } from "three";
import { IKSolver } from "./IKSolver";

export class IKSimple extends IKSolver {
    constructor(){
        super();
        this.maxIterations = 100;

    
	
	
	/**
     * 
     * @param {Object3D[]} bones 
     * @param {Vector3} target 
     */
	this.Solve=(bones,target)=> {
		const endEffector = bones[bones.length-1];
		//public Transform targetEffector = null; //the actual target end effector that we move around
		
		// Get the axis of rotation for each joint
        /**@type {Vector3[]} */
		const rotateAxes = new Array(bones.length-2);
        /**@type {number[]} */
		const rotateAngles = new Array(bones.length-2);
        /**@type {Quaternion[]} */
		const rotations = new Array(bones.length-2);
		for (let i=0; i<bones.length-2; i++) {
			rotateAxes[i] = new Vector3().crossVectors(
				bones[i+1].getWorldPosition(new Vector3).sub(bones[i].getWorldPosition(new Vector3)),
				bones[i+2].getWorldPosition(new Vector3()).sub(bones[i+1].getWorldPosition(new Vector3))
			);
			rotateAxes[i].applyQuaternion(bones[i].getWorldQuaternion(new Quaternion()).invert()).normalize();
			
			rotateAngles[i] = 
				bones[i+1].getWorldPosition(new Vector3()).sub(bones[i].getWorldPosition(new Vector3)).angleTo(
				bones[i+1].getWorldPosition(new Vector3()).sub(bones[i+2].getWorldPosition(new Vector3)));
			
			
			rotations[i] = bones[i+1].quaternion;
		}
		
		// Get the length of each bone
        /**@type {number[]} */
		const boneLengths = new Array(bones.length-1);
		let legLength = 0;
		for (let i=0; i<bones.length-1; i++) {
			boneLengths[i] = bones[i+1].getWorldPosition(new Vector3()).sub(bones[i].getWorldPosition(new Vector3)).length();
			legLength += boneLengths[i];
		}
		this.positionAccuracy = legLength*0.001;
		
		let currentDistance = (endEffector.getWorldPosition(new Vector3).sub(bones[0].getWorldPosition(new Vector3()))).length();
		const targetDistance = (target.clone().sub(bones[0].getWorldPosition(new Vector3()))).length();
		
		// Search for right joint bendings to get target distance between hip and foot
		let bendingLow, bendingHigh;
		let minIsFound = false;
		let bendMore = false;
		if (targetDistance > currentDistance) {
			minIsFound = true;
			bendingHigh = 1;
			bendingLow = 0;
		}
		else {
			bendMore = true;
			bendingHigh = 1;
			bendingLow = 0;
		}
		let tries = 0;
		while ( Math.abs(currentDistance-targetDistance) > this.positionAccuracy && tries < this.maxIterations ) {
			tries++;
			let bendingNew;
			if (!minIsFound) bendingNew = bendingHigh;
			else bendingNew = (bendingLow+bendingHigh)/2;
			for (let i=0; i<bones.length-2; i++) {
				let newAngle;
				if (!bendMore) newAngle = MathUtils.lerp(180, rotateAngles[i], bendingNew);
				else newAngle = rotateAngles[i]*(1-bendingNew) + (rotateAngles[i]-30)*bendingNew;
				const angleDiff = (rotateAngles[i]-newAngle);
				const addedRotation = new Quaternion().setFromAxisAngle(rotateAxes[i],angleDiff);
				const newRotation = addedRotation.multiply(rotations[i]);
				bones[i+1].quaternion.copy(newRotation);
			}
			currentDistance = (endEffector.getWorldPosition(new Vector3()).sub(bones[0].position)).length();
			if (targetDistance > currentDistance) minIsFound = true;
			if (minIsFound) {
				if (targetDistance > currentDistance) bendingHigh = bendingNew;
				else bendingLow = bendingNew;
				if (bendingHigh < 0.01) break;
			}
			else {
				bendingLow = bendingHigh;
				bendingHigh++;
			}
		}
		//Debug.Log("tries: "+tries);
		
		// Rotate hip bone such that foot is at desired position
		bones[0].quaternion.copy(
			new Quaternion().setFromAxisAngle(
				bones[0].worldToLocal (
				new Vector3().crossVectors(
					(endEffector.getWorldPosition(new Vector3()).sub(bones[0].position)),
					(target.clone().sub(bones[0].getWorldPosition(new Vector3())))
				)  .applyQuaternion(bones[0].quaternion))
			 ,
            
                endEffector.getWorldPosition(new Vector3)
                .sub(bones[0].getWorldPosition(new Vector3()))
                .angleTo(target.clone().sub(bones[0].position))
            )
		);
		
	}
}
}
