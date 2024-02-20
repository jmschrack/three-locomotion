/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/

import { Object3D, Quaternion, Vector3 } from "three";
import { IKSolver } from "./IKSolver";


export class IK1JointAnalytic extends IKSolver {
    constructor() {
        super();
        /**
         * 
         * @param {Object3D[]} bones 
         * @param {Vector3} target 
         */
        this.Solve = (bones, target) => {
		
		const hip = bones[0];
		const knee = bones[1];
		const ankle = bones[2];

		// Calculate the direction in which the knee should be pointing
        const vKneeDir= new Vector3().crossVectors(
            ankle.position.clone().sub(hip.position),
            new Vector3().crossVectors(
                ankle.position.clone().sub(hip.position),
                ankle.position.clone().sub(knee.position)
            )
        );
        
		// Get lengths of leg bones
		const fThighLength = (knee.getWorldPosition(new Vector3()).sub(hip.getWorldPosition(new Vector3()))).length();
		const fShinLength = (ankle.getWorldPosition(new Vector3()).sub(knee.getWorldPosition(knee.position))).length();

		// Calculate the desired new joint positions
		const pHip = hip.getWorldPosition(new Vector3());
		const pAnkle = target.clone();
		const pKnee = this.findKnee(pHip, pAnkle, fThighLength, fShinLength, vKneeDir);

		// Rotate the bone transformations to align correctly
		const hipRot = new Quaternion().setFromUnitVectors(knee.getWorldPosition(new Vector3()).sub(hip.getWorldPosition(new Vector3())), pKnee.clone().sub(pHip)).multiply(hip.quaternion);
            if (Number.isNaN(hipRot.x)) {
                console.warn("hipRot=" + hipRot + " pHip=" + pHip + " pAnkle=" + pAnkle + " fThighLength=" + fThighLength + " fShinLength=" + fShinLength + " vKneeDir=" + vKneeDir);
            }
            else {
                hip.quaternion.copy( hipRot);
                knee.quaternion.setFromUnitVectors(ankle.getWorldPosition(new Vector3()).sub(knee.getWorldPosition(new Vector3)), pAnkle.sub(pKnee)).multiply(knee.quaternion);
            }

        }
    }
    /**
     * 
     * @param {Vector3} pHip 
     * @param {Vector3} pAnkle 
     * @param {number} fThigh 
     * @param {number} fShin 
     * @param {Vector3} vKneeDir 
     * @returns 
     */
    findKnee( pHip,  pAnkle,  fThigh,  fShin,  vKneeDir) {
		const vB = pAnkle.clone().sub(pHip);
		let LB = vB.length();
		
		const maxDist = (fThigh + fShin) * 0.999;
        if (LB > maxDist) {
            // ankle is too far away from hip - adjust ankle position
            pAnkle = pHip.clone().add(vB.clone().normalize().multiplyScalar(maxDist));
            vB.copy(pAnkle).sub( pHip);
            LB = maxDist;
        }
		
		const minDist = Math.abs(fThigh - fShin) * 1.001;
        if (LB < minDist) {
            // ankle is too close to hip - adjust ankle position
            //pAnkle = pHip + vB.normalized * minDist;
            pAnkle.copy(vB).normalize().multiplyScalar(minDist).add(pHip);
            vB.copy(pAnkle).sub( pHip);
            LB = minDist;
        }
		
		const aa = (LB * LB + fThigh * fThigh - fShin * fShin) / 2 / LB;
		const bb = Math.sqrt(fThigh * fThigh - aa * aa);
		const vF =new Vector3().crossVectors(vB, new Vector3().crossVectors(vKneeDir, vB));
        return pHip.clone().add(vB.normalize().multiplyScalar(aa)).add(vF.normalize().multiplyScalar(bb));
    }

}
