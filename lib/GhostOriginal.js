import { Object3D, Vector3 } from "three";

export class GhostOriginal  {
	constructor(transform){
        /**@type {Object3D} */
        this.transform=transform;
        /**@type {Object3D} */
        this.character = null;
        this.offset = new Vector3();
    }
	
	
	Synch() {

		//foreach (AnimationState state in character.GetComponent<Animation>()) {
		/* 
			const ownState = GetComponent<Animation>()[state.name]; //AnimationState
			if (ownState==null) {
				GetComponent<Animation>().AddClip(state.clip, state.name);
				ownState = GetComponent<Animation>()[state.name];
			}
			if (ownState.enabled != state.enabled) {
				ownState.wrapMode = state.wrapMode;
				ownState.enabled = state.enabled;
				ownState.speed = state.speed;
			}
			ownState.weight = state.weight;
			ownState.time = state.time;
		} */
	}
	
	LateUpdate() {
        this.character.getWorldPosition(this.transform.position).add(this.offset)
		this.character.getWorldQuaternion(this.transform.quaternion);
	}
}
