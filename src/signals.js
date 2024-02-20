import { Signal, signal } from "@preact/signals";
import { deepSignal } from "deepsignal";
import { LegController } from "../lib/locomotion";
import { AnimationAction } from "three";


export const fileSignal = signal(null);

export const gltfSignal = signal(null);


export const legC = deepSignal({
    groundedPose: null, 
    transform: null, 
    sourceAnimations: [], 
    leftLegUpper: null, 
    leftLegFoot: null, 
    leftLegToe: null, 
    rightLegUpper: null, 
    rightLegFoot: null, 
    rightLegToe: null,


});
/**@type {Signal<AnimationAction[]>} */
export const animationList = signal([])

export const motionList = signal([])
