import Main from "./src/main";

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LegController, LegInfo, MotionGroupInfo } from "./lib/locomotion";
import { effect } from "@preact/signals";
import { animationList, fileSignal, gltfSignal, legC, motionList } from "./src/signals";
import { MotionAnalyzer } from "./lib/motionAnalyzerBackwards";
import { MotionType } from "./lib/data";
import { MultiplyVector, RelativeMatrix, forward, up } from "./lib/util";
import { SetRenderer } from "./lib/globals";
import { LegAnimator } from "./lib/legAnimator";
import { SimulatedAlignmentTracker } from "./lib/AlignmentTracker";

let file = null;
const loader = new GLTFLoader();


const scene = new THREE.Scene();
const gridHelper = new THREE.GridHelper(  );
scene.add( gridHelper );
const camera = new THREE.PerspectiveCamera(75, (window.innerWidth / 2) / window.innerHeight, 0.1, 1000);
camera.position.x = -10;
camera.position.y = 14;
camera.position.z = 10;
const light = new THREE.AmbientLight(0x404040); // soft white light
const dirLight = new THREE.DirectionalLight(0xffffff);
scene.add(light, dirLight);

//add a plane to the scene
const planeGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -0.5 * Math.PI;
scene.add(plane);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth / 2, window.innerHeight);
document.getElementById("render").appendChild(renderer.domElement);
renderer.setClearColor(0xaaaaaa, 1);
function onWindowResize() {

    camera.aspect = (window.innerWidth/2) / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth/2, window.innerHeight);

}
window.addEventListener('resize', onWindowResize, false);
SetRenderer(()=>{renderer.render(scene, camera);})
const controls = new OrbitControls(camera, renderer.domElement);

const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
//scene.add(cube);

effect(() => {
    if (file == null) {
        if (fileSignal.value == null) return;

        loader.load(URL.createObjectURL(fileSignal.value), function (gltf) {
            gltfSignal.value = gltf;
            file = gltf;
            scene.add(gltf.scene);
            console.log("Loaded gltf", gltf.scene);
            controls.target = gltf.scene.position;
            const helper = new THREE.SkeletonHelper( gltf.scene );
scene.add( helper );
            const mixer = new THREE.AnimationMixer(gltf.scene);
            /**@type {THREE.AnimationAction[]} */
            const actions = gltf.animations.map(a => mixer.clipAction(a));
            animationList.value = actions;
            legC.transform = gltf.scene.getObjectByName("mixamorigHips").name;
            legC.groundedPose = (actions.find(actions => actions.getClip().name == "idle"))
            legC.sourceAnimations = actions;//.map(a=>new MotionAnalyzer(gltf.scene,a));
            legC.leftLegUpper = gltf.scene.getObjectByName("mixamorigLeftUpLeg").name;
            legC.leftLegFoot = gltf.scene.getObjectByName("mixamorigLeftFoot").name;
            legC.leftLegToe = gltf.scene.getObjectByName("mixamorigLeftToe_End").name;
            legC.rightLegUpper = gltf.scene.getObjectByName("mixamorigRightUpLeg").name;
            legC.rightLegFoot = gltf.scene.getObjectByName("mixamorigRightFoot").name;
            legC.rightLegToe = gltf.scene.getObjectByName("mixamorigRightToe_End").name;
            //camera.position.z = 5;
            //const mixer = new THREE.AnimationMixer( gltf.scene );
            //const action = mixer.clipAction( gltf.animations[ 0 ] );
            //action.play();
            //const legController = new LegController(gltf.scene);
            //legController.init();
            //legController.animate();
        }, undefined, function (error) {
            console.error(error);
        });
    }

})


function InitializeLegController() {
    const legController = new LegController();
    legController.groundedPose = animationList.value.find(a => a.getClip().name == "idle");
    legController.transform = file.scene;
    legController.rootBone = file.scene.getObjectByName(legC.transform);
    const groundCenter = legController.transform.getWorldPosition(new THREE.Vector3()).add(MultiplyVector(up(), legController.transform.matrixWorld).multiplyScalar(legController.groundPlaneHeight * legController.transform.scale.y));

    /*
    Vector3 groundCenter = (
            lc.transform.position
                + lc.groundPlaneHeight * up * lc.transform.lossyScale.y
        );
        Handles.color = (Color.green+Color.white)/2;
        Handles.DrawLine(groundCenter-forward, groundCenter+forward);
        Handles.DrawLine(groundCenter-right, groundCenter+right);
     */
    const groundPoint1 = new THREE.ArrowHelper(forward(), groundCenter, 1, 0x00ff00);
    const groundPoint2 = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), groundCenter, 1, 0x00ff00);
    //scene.add(groundPoint1, groundPoint2);


    const left = new LegInfo();
    left.ankle = file.scene.getObjectByName(legC.leftLegFoot);
    left.hip = file.scene.getObjectByName(legC.leftLegUpper);
    left.toe = file.scene.getObjectByName(legC.leftLegToe);
    left.footLength = 0.3;
    left.footWidth = 0.15;
    left.footOffset = new THREE.Vector2(0, 0);
    const right = new LegInfo();
    right.ankle = file.scene.getObjectByName(legC.rightLegFoot);
    right.hip = file.scene.getObjectByName(legC.rightLegUpper);
    right.toe = file.scene.getObjectByName(legC.rightLegToe);
    right.footLength = 0.3;
    right.footWidth = 0.15;
    right.footOffset = new THREE.Vector2(0, 0);
    legController.legs.push(left, right);
    /*
if (lc.groundedPose==null) return;
        float scale = lc.transform.lossyScale.z;
        for (int leg=0; leg<lc.legs.Length; leg++) {
            if (lc.legs[leg].ankle==null) continue;
            if (lc.legs[leg].toe==null) continue;
            if (lc.legs[leg].footLength+lc.legs[leg].footWidth==0) continue;
            lc.InitFootData(leg); // Note: Samples animation
            Vector3 heel = lc.legs[leg].ankle.TransformPoint(lc.legs[leg].ankleHeelVector);
            Vector3 toetip = lc.legs[leg].toe.TransformPoint(lc.legs[leg].toeToetipVector);
            Vector3 side = (Quaternion.AngleAxis(90,up) * (toetip-heel)).normalized * lc.legs[leg].footWidth * scale;
            Handles.DrawLine(heel+side/2, toetip+side/2);
            Handles.DrawLine(heel-side/2, toetip-side/2);
            Handles.DrawLine(heel-side/2, heel+side/2);
            Handles.DrawLine(toetip-side/2, toetip+side/2);
        }
    */
    legController.legs.forEach((leg, i) => {
        legController.InitFootData(i);
        const up = MultiplyVector(new THREE.Vector3(0, 1, 0),legController.transform.matrixWorld);
        const heel = leg.ankle.localToWorld(leg.ankleHeelVector.clone());
        const toetip = leg.toe.localToWorld(leg.toeToetipVector.clone());
        const footLine = new THREE.ArrowHelper(toetip.clone().sub(heel).normalize(), heel, toetip.clone().sub(heel).length(), 0x00ffff, 0, 0);

        const q = new THREE.Quaternion().setFromAxisAngle(up, THREE.MathUtils.DEG2RAD * 90);
        const side = (toetip.clone().sub(heel)).applyQuaternion(q).normalize().multiplyScalar(leg.footWidth).multiplyScalar(0.5);

        const orig1 = heel.clone().add(side);
        const dir1 = toetip.clone().add(side).sub(orig1);
        const len1 = dir1.length();
        dir1.normalize();

        const orig2 = heel.clone().sub(side);
        const dir2 = toetip.clone().sub(side).sub(orig2)
        const len2 = dir2.length();
        dir2.normalize();

        const dir3 = heel.clone().add(side).sub(orig2);
        const len3 = dir3.length();
        dir3.normalize();

        const orig4 = toetip.clone().sub(side);
        const dir4 = toetip.clone().add(side).sub(orig4)
        const len4 = dir4.length();
        dir4.normalize();

        const line1 = new THREE.ArrowHelper(dir1, orig1, len1, 0xff0000, 0, 0);
        const line2 = new THREE.ArrowHelper(dir2, orig2, len2, 0xff0000, 0, 0);
        const line3 = new THREE.ArrowHelper(dir3, orig2, len3, 0xff0000, 0, 0);
        const line4 = new THREE.ArrowHelper(dir4, orig4, len4, 0xff0000, 0, 0);
        scene.add(line1, line2, line3, line4,footLine);
    })

    
    legController.sourceAnimations = animationList.value.map(a => new MotionAnalyzer(file.scene, a));
    legController.m_Motions = legController.sourceAnimations;//animationList.value.map(a=>new MotionAnalyzer(file.scene,a));
    legController.sourceAnimations.forEach(m => { m.legC = legController });
    const locomotionGroup = new MotionGroupInfo();
    locomotionGroup.name = 'locomotion';
    locomotionGroup.motions = legController.motions.filter(m=>m.animation.checked)//[legController.motions.find(m => m.animation.getClip().name == "idle"), legController.motions.find(m => m.animation.getClip().name.includes( "walk")), legController.motions.find(m => m.animation.getClip().name == "run")];
    locomotionGroup.motions.forEach(m=>{m.motionType=MotionType.WalkCycle})

    legController.motionGroups.push(locomotionGroup);
    //legController.InitFootData(1);
    legController.Init();
    legController.Init2();
    locomotionGroup.motions.forEach(m => {
        /**@type {MotionAnalyzer} */
        const motion = m;
        console.log(m.animation.getClip().name, motion)

    })
    motionList.value=locomotionGroup.motions;
    const run= legController.motions.find(m => m.animation.getClip().name == "walk");
    animationList.value.forEach(a => a.stop().reset());
    //run.animation.reset().play();
    run.animation.getMixer().timeScale=1
    const opt={
        normalizeGraph:true,
        drawHeelToe:true,
        drawFootBase:false,
    }
    run.RenderGraphAll(opt,0);
    Object.keys(run.lineCache).forEach(k=>{scene.add(run.lineCache[k])});
    Object.keys(run.diamondCache).forEach(k=>{scene.add(run.diamondCache[k])});
   
    //create a raycaster
    const raycaster = new THREE.Raycaster();
    

    const fakeAlign = new SimulatedAlignmentTracker()
    const la=new LegAnimator(file.scene,(origin,direction)=>{
        raycaster.set(origin,direction);
        return raycaster.intersectObject(plane,false );
    },legController,fakeAlign)
   
    la.Start();
    la.OnEnable();
    
    
    updateList.push((delta,time) => {
        run.animation.getMixer().update(delta);
        la.LateUpdate(delta,time)
        fakeAlign.m_Velocity=new THREE.Vector3(0,0,5);
    fakeAlign.m_VelocitySmoothed.copy(fakeAlign.m_Velocity);
        //run.RenderGraphAll(opt,0);
    });
}

//create a clock for keeping up with the delta time each frame
const clock = new THREE.Clock();
const updateList=[]

function animate() {
    const delta = clock.getDelta();
    updateList.forEach(u=>u(delta,clock.getElapsedTime()));
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();


Main(InitializeLegController);
