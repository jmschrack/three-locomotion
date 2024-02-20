import { AnimationAction, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { animationList } from "../src/signals";
import { LegController } from "./locomotion";

export function Mod(x, period = 1) {
    const r = x % period;
    return (r >= 0 ? r : r + period);
}


export const zero = () => new Vector3(0, 0, 0);
export const one = () => new Vector3(1, 1, 1);
export const right = () => new Vector3(-1, 0, 0);
export const up = () => new Vector3(0, 1, 0);
export const forward = () => new Vector3(0, 0, 1);
export const left = () => new Vector3(1, 0, 0);
/**
 * Modifies the vector v
 * @param {Vector3} v 
 * @param {Vector3} normal 
 * @returns 
 */
export function ProjectOntoPlane(v, normal) {
    return v.sub(v.clone().projectOnVector(normal))
    //return v-Vector3.Project(v,normal);
}
/**
 * 
 * @param {number} high 
 * @param {number} low 
 * @param {number} period 
 * @param {boolean} skipWrap 
 * @returns 
 */
export function CyclicDiff(high, low, period = 1, skipWrap = false) {
    if (!skipWrap) {
        high = Mod(high, period);
        low = Mod(low, period);
    }
    return (high >= low ? high - low : high + period - low);
}
/**
 * 
 * @param {Vector3} from 
 * @param {Vector3} to 
 * @param {number} angle 
 * @returns 
 */
export function ConstantSlerp(from, to, angle) {
    let value = Math.min(1, angle / from.angleTo(to));
    return from.clone().lerp(to, value); //TODO  slerp ?
    //return Vector3.Slerp(from, to, value);
}
/**
 * 
 * @param {Quaternion} from 
 * @param {Quaternion} to 
 * @param {number} angle 
 * @returns 
 */
export function QuatConstantSlerp(from, to, angle) {

    let value = Math.min(1, angle / from.angleTo(to));
    return from.clone().slerp(to, value);
}

export function ToAxisAngle(quaternion) {
    const angle = 2 * Math.acos(quaternion.w);
    //if (angle == 0) return { axis: new Vector3(0, 0, 1), angle: 0 };

    let s = Math.sqrt(1 - quaternion.w * quaternion.w);
    s = s < 0.0001 ? 1 : s;
    const axis = new Vector3(quaternion.x / s, quaternion.y / s, quaternion.z / s);
    return { axis, angle };
}
/**
 * 
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns 
 */
export function Clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}
/**
 * 
 * @param {number} value 
 * @returns 
 */
export function Clamp01(value) {
    return Math.max(0, Math.min(value, 1));
}
/*
angle = 2 * acos(qw)
x = qx / sqrt(1-qw*qw)
y = qy / sqrt(1-qw*qw)
z = qz / sqrt(1-qw*qw)
*/


/**
 * 
 * @param {Vector3} forward 
 * @param {Vector3} up 
 * @returns {Quaternion}
 */
export function LookRotation(forward, up) {

    forward = forward.clone().normalize();
    const right = up.clone().cross(forward).normalize();//  Vector3.Normalize(Vector3.Cross(up, forward));
    up = forward.clone().cross(right);//Vector3.Cross(forward, right);
    const m00 = right.x;
    const m01 = right.y;
    const m02 = right.z;
    const m10 = up.x;
    const m11 = up.y;
    const m12 = up.z;
    const m20 = forward.x;
    const m21 = forward.y;
    const m22 = forward.z;


    const num8 = (m00 + m11) + m22;
    const quaternion = new Quaternion();
    if (num8 > 0) {
        var num = Math.sqrt(num8 + 1);
        quaternion.w = num * 0.5;
        num = 0.5 / num;
        quaternion.x = (m12 - m21) * num;
        quaternion.y = (m20 - m02) * num;
        quaternion.z = (m01 - m10) * num;
        return quaternion;
    }
    if ((m00 >= m11) && (m00 >= m22)) {

        var num7 = Math.sqrt(((1 + m00) - m11) - m22);
        var num4 = 0.5 / num7;
        quaternion.x = 0.5 * num7;
        quaternion.y = (m01 + m10) * num4;
        quaternion.z = (m02 + m20) * num4;
        quaternion.w = (m12 - m21) * num4;
        return quaternion;
    }
    if (m11 > m22) {
        var num6 = Math.sqrt(((1 + m11) - m00) - m22);
        var num3 = 0.5 / num6;
        quaternion.x = (m10 + m01) * num3;
        quaternion.y = 0.5 * num6;
        quaternion.z = (m21 + m12) * num3;
        quaternion.w = (m20 - m02) * num3;
        return quaternion;
    }
    var num5 = Math.sqrt(((1 + m22) - m00) - m11);
    var num2 = 0.5 / num5;
    quaternion.x = (m20 + m02) * num2;
    quaternion.y = (m21 + m12) * num2;
    quaternion.z = 0.5 * num5;
    quaternion.w = (m01 - m10) * num2;
    return quaternion;
}


/**
 * 
 * @param {AnimationAction} animation 
 * @param {number} time 
 */
export function SampleAnimation(animation, time) {
    animationList.value.forEach(a => a.stop().reset());
    animation.time = time;
    animation.play();
    animation.getMixer().time = time;
    animation.getMixer().update(0);
}

/**
 * 
 * @param {Vector3} originalVector 
 * @param {Vector3} referenceHeightVector 
 * @param {Vector3} upVector 
 * @returns 
 */
export function SetHeight(originalVector, referenceHeightVector, upVector) {
    const originalOnPlane = ProjectOntoPlane(originalVector, upVector);
    const referenceOnAxis = referenceHeightVector.clone().projectOnVector(upVector)
    return originalOnPlane.add(referenceOnAxis);
}

export function MatGetColumn(mat, c) {
    return new Vector3(mat.elements[c], mat.elements[c + 4], mat.elements[c + 8]);
}

export function MatSetColumn(mat, c, v) {
    mat.elements[c] = v.x;
    mat.elements[c + 4] = v.y;
    mat.elements[c + 8] = v.z;
}

/**
 * 
 * @param {Vector3} lineStart 
 * @param {Vector3} lineDir 
 * @param {Vector3} sphereCenter 
 * @param {number} sphereRadius 
 * @returns 
 */
export function GetLineSphereIntersections(lineStart, lineDir, sphereCenter, sphereRadius) {
    /*double a = lineDir.sqrMagnitude;
    double b = 2 * (Vector3.Dot(lineStart, lineDir) - Vector3.Dot(lineDir, sphereCenter));
    double c = lineStart.sqrMagnitude + sphereCenter.sqrMagnitude - 2*Vector3.Dot(lineStart, sphereCenter) - sphereRadius*sphereRadius;
    double d = b*b - 4*a*c;
    if (d<0) return null;
    double i1 = (-b - System.Math.Sqrt(d)) / (2*a);
    double i2 = (-b + System.Math.Sqrt(d)) / (2*a);
    if (i1<i2) return new float[] {(float)i1, (float)i2};
    else       return new float[] {(float)i2, (float)i1};*/

    const a = lineDir.lengthSq();
    const b = 2 * (lineStart.dot(lineDir) - lineDir.dot(sphereCenter));
    const c = lineStart.lengthSq() + sphereCenter.lengthSq() - 2 * lineStart.dot(sphereCenter) - sphereRadius * sphereRadius;
    const d = b * b - 4 * a * c;
    if (d < 0) return null;
    const i1 = (-b - Math.sqrt(d)) / (2 * a);
    const i2 = (-b + Math.sqrt(d)) / (2 * a);
    if (i1 < i2) return [i1, i2];
    else return [i2, i1];
}

/**
 * 
 * @param {Quaternion} q 
 * @param {Vector3} p 
 * @returns 
 */
export function MatrixFromQuaternionPosition(q, p) {
    return new Matrix4().compose(p, q, new Vector3(1, 1, 1));
    /* const m = MatrixFromQuaternion(q);
    m.SetColumn(3,p);
    m[3,3] = 1;
    return m; */
}


/**
 * 
 * @param {Object3D} transform 
 * @param {Object3D} relativeTo 
 * @returns 
 */
export function RelativeMatrix(transform, relativeTo) {
    //return relativeTo.worldToLocalMatrix * t.localToWorldMatrix;
    transform.updateWorldMatrix(true, true);
    relativeTo.updateWorldMatrix(true, true);
    const t = transform.matrixWorld.clone();
    const rt = relativeTo.matrixWorld.clone().invert();
    t.multiplyMatrices(rt, t);

    return t;
    //return (point)=>relativeTo.worldToLocal( transform.localToWorld(point));
}

/* export function InverseRelativeMatrix(transform,relativeTo){
    return (point)=>transform.worldToLocal(relativeTo.localToWorld(point));

}
 */
function getMat(matrix, row, col) {
    return matrix.elements[row * 4 + col];
}

/**
 * 
 * @param {Vector3} vector 
 * @param {Matrix4} matrix 
 * @returns 
 */
export function MultiplyVector(vector, matrix) {
    const rotationMatrix = new Matrix4();
    rotationMatrix.extractRotation(matrix);


    const res = new Vector3().copy(vector);
    res.applyMatrix4(rotationMatrix);
    /* 
    res.x = getMat(matrix,0,0) * vector.x + getMat(matrix,0,1) * vector.y + getMat(matrix,0,2) * vector.z;
    res.y = getMat(matrix,1,0) * vector.x + getMat(matrix,1,1) * vector.y + getMat(matrix,1,2) * vector.z;
    res.z = getMat(matrix,2,0) * vector.x + getMat(matrix,2,1) * vector.y + getMat(matrix,2,2) * vector.z; */
    return res;
}
/**
 * 
 * @param {Matrix4} m 
 * @param {Vector3} v 
 * @returns 
 */
export function TransformVector(m, v) {
    return v.clone().applyMatrix4(m).sub(new Vector3(0, 0, 0).applyMatrix4(m));//m.MultiplyPoint(v) - m.MultiplyPoint(Vector3.zero);
}

/**
 * 
 * @param {LegController} legC 
 * @param {AnimationAction} animation 
 * @returns 
 */
/* export function SanityCheckAnimationCurves(legC, animation) {
    EditorCurveBinding[] curveData = AnimationUtility.GetCurveBindings (animation);
    
    let hasRootPosition = false;
    let hasRootRotation = false;
    
    // Check each joint from hip to ankle in each leg
    
    const hasJointRotation = new Array(legC.legs.length);
    for (let i=0; i<legC.legs.length; i++) {
        hasJointRotation[i] = new Array(legC.legs[i].legChain.length);
    }

    foreach (EditorCurveBinding data in curveData) {
        Transform bone = legC.transform.Find(data.path);
        if (bone==legC.root && data.propertyName=="m_LocalPosition.x") hasRootPosition = true;
        if (bone==legC.root && data.propertyName=="m_LocalRotation.x") hasRootRotation = true;
        for (let i=0; i<legC.legs.length; i++) {
            for (let j=0; j<legC.legs[i].legChain.length; j++) {
                if (bone==legC.legs[i].legChain[j] &&  data.propertyName=="m_LocalRotation.x") {
                    hasJointRotation[i][j] = true;
                }
            }
        }
    }
    
    let success = true;
    
    if (!hasRootPosition) {
        console.error("AnimationClip \""+animation.getClip().name+"\" is missing animation curve for the position of the root bone \""+legC.root.name+"\".");
        success = false;
    }
    if (!hasRootRotation) {
        console.error("AnimationClip \""+animation.getClip().name+"\" is missing animation curve for the rotation of the root bone \""+legC.root.name+"\".");
        success = false;
    }
    for (let i=0; i<legC.legs.length; i++) {
        for (let j=0; j<legC.legs[i].legChain.length; j++) {
            if (!hasJointRotation[i][j]) {
                console.error("AnimationClip \""+animation.getClip().name+"\" is missing animation curve for the rotation of the joint \""+legC.legs[i].legChain[j].name+"\" in leg "+i+".");
                success = false;
            }
        }
    }
    
    return success;
} */