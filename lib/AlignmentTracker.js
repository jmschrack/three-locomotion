/*
Copyright (c) 2008, Rune Skovbo Johansen & Unity Technologies ApS

See the document "TERMS OF USE" included in the project folder for licencing details.
*/

import { Object3D, Quaternion, Vector3 } from "three";
import * as Util from "./util";

export class AlignmentTracker {
	constructor(transform){
        
        this.fixedUpdate = false;
        this.m_CurrentFixedTime = 0;
        this.m_CurrentLateTime = 0;
        this.m_Position = new Vector3();
        this.m_PositionPrev = new Vector3();
        this.m_Velocity = new Vector3();
        this.m_VelocityPrev = new Vector3();
        this.m_VelocitySmoothed = new Vector3();
        this.m_Acceleration = new Vector3();
        this.m_AccelerationSmoothed = new Vector3();
        this.m_Rotation = new Quaternion();
        this.m_RotationPrev = new Quaternion();
        this.m_AngularVelocity = new Vector3();
        this.m_AngularVelocitySmoothed = new Vector3();
        //this.m_Rigidbody = new Rigidbody
        /**@type {Object3D} */
        this.m_Transform = transform;

    }
    get position() { return this.m_Position; }
	
	get velocity() { return this.m_Velocity; }
    get velocitySmoothed() { return this.m_VelocitySmoothed; }
	
    get acceleration() { return this.m_Acceleration; }
	
    get accelerationSmoothed() { return this.m_AccelerationSmoothed; }

    get rotation() { return this.m_Rotation; }
	
    get angularVelocity() { return this.m_AngularVelocity; }
    get angularVelocitySmoothed() { return this.m_AngularVelocitySmoothed; }
	
	
	
	Awake() {
		this.Reset();
	}
	
	OnEnable () {
		this.Reset();
	}
	
	Reset () {
		//this.m_Rigidbody = GetComponent<Rigidbody>();
		//m_Transform = transform;
		this.m_CurrentLateTime = -1;
		this.m_CurrentFixedTime = -1;
		this.m_Position = this.m_PositionPrev = this.m_Transform.position;
		this.m_Rotation = this.m_RotationPrev = this.m_Transform.quaternion;
		this.m_Velocity = Util.zero();
		this.m_VelocityPrev = Util.zero();
		this.m_VelocitySmoothed = Util.zero();
		this.m_Acceleration = Util.zero();
		this.m_AccelerationSmoothed = Util.zero();
		this.m_AngularVelocity = Util.zero();
		this.m_AngularVelocitySmoothed = Util.zero();
	}
	/**
     * 
     * @param {Quaternion} prev 
     * @param {Quaternion} current 
     * @param {number} deltaTime
     * @returns 
     */
	CalculateAngularVelocity( prev,  current,deltaTime) {
		const deltaRotation = new Quaternion().multiplyQuaternions(prev.clone().invert(),current);
		let {angle,axis}=Util.ToAxisAngle(deltaRotation);
		
		if (axis.equals(Util.zero()) || axis.x == Number.POSITIVE_INFINITY || axis.x == Number.NEGATIVE_INFINITY)
			return Util.zero();
		if (angle>180) angle -= 360;
		angle = angle/deltaTime;
		return axis.normalize().multiplyScalar(angle);
	}
	
	UpdateTracking(deltaTime) {
		 this.m_Transform.getWorldPosition(this.m_Position);
         this.m_Transform.getWorldQuaternion(this.m_Rotation);
		
		
		/* if (this.m_Rigidbody!=null) {
			// Rigidbody velocity is not reliable, so we calculate our own
			m_Velocity = (m_Position-m_PositionPrev)/Time.deltaTime;
			
			// Rigidbody angularVelocity is not reliable, so we calculate out own
			m_AngularVelocity = CalculateAngularVelocity(m_RotationPrev, m_Rotation);
		}
		else */ {
			this.m_Velocity = this.m_Position.clone().sub(this.m_PositionPrev).divideScalar(deltaTime)
			this.m_AngularVelocity = this.CalculateAngularVelocity(this.m_RotationPrev, this.m_Rotation,deltaTime);
			
		}
		
		this.m_Acceleration = this.m_Velocity.clone().sub(this.m_VelocityPrev).divideScalar(deltaTime)
		
		this.m_PositionPrev = this.m_Position.clone();
		this.m_RotationPrev = this.m_Rotation.clone();
		this.m_VelocityPrev = this.m_Velocity.clone();
	}
	
	ControlledFixedUpdate(deltaTime,time) {
		if (deltaTime == 0 ) return; //|| Time.timeScale == 0
		
		if (this.m_CurrentFixedTime==time) return;
		this.m_CurrentFixedTime = time;
		
		if (this.fixedUpdate) this.UpdateTracking();
	}
	
	ControlledLateUpdate (deltaTime,time) {
		if (deltaTime == 0 ) return; //|| Time.timeScale == 0
		
		if (this.m_CurrentLateTime==time) return;
		this.m_CurrentLateTime = time;
		
		if (!this.fixedUpdate) this.UpdateTracking();
		
		this.m_VelocitySmoothed =  new Vector3().lerpVectors(this.m_VelocitySmoothed, this.m_Velocity, deltaTime*10);
		
		this.m_AccelerationSmoothed = new Vector3().lerpVectors(
			this.m_AccelerationSmoothed, this.m_Acceleration, deltaTime*3
		);
		
		this.m_AngularVelocitySmoothed =new Vector3().lerpVectors(
			this.m_AngularVelocitySmoothed, this.m_AngularVelocity, deltaTime*3
		);
		
		if (this.fixedUpdate) {
			this.m_Position.add(this.m_Velocity.clone().multiplyScalar(deltaTime));
		}
	}
}

export class SimulatedAlignmentTracker{
	constructor(){
		this.m_Position = new Vector3();
		this.m_PositionPrev = new Vector3();
		this.m_Velocity = new Vector3();
		this.m_VelocityPrev = new Vector3();
		this.m_VelocitySmoothed = new Vector3();
		this.m_Acceleration = new Vector3();
		this.m_AccelerationSmoothed = new Vector3();
		this.m_Rotation = new Quaternion();
		this.m_RotationPrev = new Quaternion();
		this.m_AngularVelocity = new Vector3();
		this.m_AngularVelocitySmoothed = new Vector3();
		this.m_Transform = new Object3D();
	}
	Reset(){
		this.m_Position = this.m_PositionPrev = this.m_Transform.position;
		this.m_Rotation = this.m_RotationPrev = this.m_Transform.quaternion;
		this.m_Velocity = Util.zero();
		this.m_VelocityPrev = Util.zero();
		this.m_VelocitySmoothed = Util.zero();
		this.m_Acceleration = Util.zero();
		this.m_AccelerationSmoothed = Util.zero();
		this.m_AngularVelocity = Util.zero();
		this.m_AngularVelocitySmoothed = Util.zero();
	}
	ControlledLateUpdate(deltaTime){
	}
	ControlledFixedUpdate(deltaTime){
	}
	UpdateTracking(){

	}
	CalculateAngularVelocity(prev, current, deltaTime){
	}
}