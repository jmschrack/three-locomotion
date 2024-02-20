/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/

import { Object3D, Vector3 } from "three";

export class IKSolver {
	constructor(){
        this.positionAccuracy = 0.001;
        /**
         * 
         * @param {Object3D[]} bones 
         * @param {Vector3} target 
         */
        this.Solve=(bones,target)=>{}
    }
	
	
}
