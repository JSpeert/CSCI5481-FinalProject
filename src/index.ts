/* CSCI 5619 Lecture 13, Fall 2020
 * Author: Evan Suma Rosenberg
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Space } from "@babylonjs/core/Maths/math";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllercomponent";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRCamera } from "@babylonjs/core/XR/webXRCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Sound } from "@babylonjs/core/Audio/sound";
import { Logger } from "@babylonjs/core/Misc/logger";
import { GUI3DManager } from "@babylonjs/gui/3D/gui3DManager";
import { AssetsManager } from "@babylonjs/core/Misc/assetsManager";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import {MeshBuilder} from  "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";

// Physics
import * as Cannon from "cannon"
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import "@babylonjs/core/Physics/physicsEngineComponent";

// Side effects
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";
import { Material } from "@babylonjs/core/Materials/material";
import { float, int } from "@babylonjs/core/types";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Button3D } from "@babylonjs/gui/3D/controls/button3D";
import { WebXRExperienceHelper } from "@babylonjs/core/XR/webXRExperienceHelper";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";

class Game 
{ 
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private xrCamera: WebXRCamera | null;
    private xrHelper: WebXRDefaultExperience | null;
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;

    private GUI_Node: TransformNode;
    private WIM_Node: TransformNode;
    private largeObjects: Mesh[];
    private WIMObjects: Mesh[];
    private miniSkybox: Mesh | null;
    private WIMScaleFactor: float;
    private selectedObjectIndex: int | null;
    private selectedObject: AbstractMesh | null;
    private selectionTransform: TransformNode | null;
    private teleportPoint: Vector3 | null;
    private teleportAngle: number;
    private teleportMarker: TransformNode;

    private laserPointer: LinesMesh | null;
    private bimanualLine: LinesMesh | null;
    private miniatureObject: InstancedMesh | null;

    private previousLeftControllerPosition: Vector3;
    private previousRightControllerPosition: Vector3;

    private Building_Node: TransformNode;

    private Vehicle_Node: TransformNode;
    private Vehicle_Meshes: Mesh[];
    private leftLever_Node: TransformNode;
    private rightLever_Node: TransformNode;

    // Values to be toggled
    private GUI_Active: Boolean;
    private GUISwitchEnabled: Boolean;
    private Vehicle_Active: Boolean;
    private VehicleSwitchEnabled: Boolean;
    private Materials: Material[];
    private MaterialIndex: int;
    private cubeMass: float;
    private wreckingBallMass: float;
    
    constructor()
    {
        // Get the canvas element 
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

        // Generate the BABYLON 3D engine
        this.engine = new Engine(this.canvas, true); 

        // Creates a basic Babylon Scene object
        this.scene = new Scene(this.engine);   

        this.xrCamera = null;
        this.xrHelper = null;
        this.leftController = null;
        this.rightController = null;
    
        this.selectedObject = null;
        this.selectionTransform = null;
        this.teleportPoint = null;
        this.teleportAngle = 0;
        this.teleportMarker = new TransformNode("TeleportMarker", this.scene);
        this.laserPointer = null;
        this.bimanualLine = null;
        this.miniatureObject = null;

        this.previousLeftControllerPosition = Vector3.Zero();
        this.previousRightControllerPosition = Vector3.Zero();

        this.Building_Node = new TransformNode("Building", this.scene);

        this.Vehicle_Node = new TransformNode("Vehicle", this.scene);
        this.Vehicle_Meshes = [];
        this.leftLever_Node = new TransformNode("LeftLever", this.scene);
        this.rightLever_Node = new TransformNode("RightLever", this.scene);    

        this.GUI_Node = new TransformNode("GUI", this.scene);
        this.WIM_Node = new TransformNode("WIM", this.scene);
        this.largeObjects = [];
        this.WIMObjects = [];
        this.selectedObjectIndex = null;
        this.miniSkybox = null;
        this.WIMScaleFactor = 0.01;

        this.GUI_Active = false;
        this.GUISwitchEnabled = true;
        this.Vehicle_Active = false;
        this.VehicleSwitchEnabled = true;
        this.Materials = [];
        this.MaterialIndex = 0;
        this.cubeMass = 1;
        this.wreckingBallMass = 50;
    }

    start() : void 
    {
        // Create the scene and then execute this function afterwards
        this.createScene().then(() => {

            // Register a render loop to repeatedly render the scene
            this.engine.runRenderLoop(() => { 
                this.update();
                this.scene.render();
            });

            // Watch for browser/canvas resize events
            window.addEventListener("resize", () => { 
                this.engine.resize();
            });
        });
    }

    private async createScene() 
    {
        // This creates and positions a first-person camera (non-mesh)
        var camera = new UniversalCamera("camera1", new Vector3(0, 1.6, 0), this.scene);
        camera.fov = 90 * Math.PI / 180;
        camera.minZ = .1;
        camera.maxZ = 100;

        // This attaches the camera to the canvas
        camera.attachControl(this.canvas, true);

       // Create a point light
       var pointLight = new PointLight("pointLight", new Vector3(0, 2.5, 0), this.scene);
       pointLight.intensity = 1.0;
       pointLight.diffuse = new Color3(.25, .25, .25);

        // Creates a default skybox
        const environment = this.scene.createDefaultEnvironment({
            createGround: true,
            groundSize: 50,
            skyboxSize: 50,
            skyboxColor: new Color3(0, 90/255, 1)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.ground!.isPickable = false;
        environment!.ground!.scaling = new Vector3(2, 2, 2);
        environment!.skybox!.isPickable = false;
        environment!.skybox!.scaling = new Vector3(2, 2, 2);

        // Make a miniaturized version of the skybox for the WIM
        this.miniSkybox = environment!.rootMesh.clone();
        this.miniSkybox!.name = "miniSkyBox";
        this.miniSkybox!.parent = this.WIM_Node;
        this.miniSkybox!.scaling = new Vector3(0.5, 0.5, 0.5);
        this.miniSkybox!.isVisible = false;
        var skyboxChildren = this.miniSkybox!.getChildMeshes();
        for (var mesh of skyboxChildren) {
            if (mesh.name == ".BackgroundPlane") {
                mesh.isPickable = true;
            } else {
                mesh.isPickable = false;
            }
        }

        // Creates the XR experience helper
        this.xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Assigns the web XR camera to a member variable
        this.xrCamera = this.xrHelper.baseExperience.camera;

        // Remove default teleportation and pointer selection
       this.xrHelper.teleportation.dispose();
       this.xrHelper.pointerSelection.dispose();

        // Create points for the laser pointer
        var laserPoints = [];
        laserPoints.push(new Vector3(0, 0, 0));
        laserPoints.push(new Vector3(0, 0, 10));

        // Create a laser pointer and make sure it is not pickable
        this.laserPointer = MeshBuilder.CreateLines("laserPointer", {points: laserPoints}, this.scene);
        this.laserPointer.color = Color3.Blue();
        this.laserPointer.alpha = .5;
        this.laserPointer.visibility = 0;
        this.laserPointer.isPickable = false;

        // Create points for the bimanual line
        var bimanualPoints = [];
        bimanualPoints.push(new Vector3(0, 0, 0));
        bimanualPoints.push(new Vector3(0, 0, 1));

       // Create a dashed line between the two controllers
        this.bimanualLine = MeshBuilder.CreateDashedLines("bimanualLine", {points: bimanualPoints}, this.scene);
        this.bimanualLine.color = Color3.Gray();
        this.bimanualLine.alpha = .5;
        this.bimanualLine.visibility = 0;
        this.bimanualLine.isPickable = false;

        // This transform will be used to attach objects to the laser pointer
        this.selectionTransform = new TransformNode("selectionTransform", this.scene);
        this.selectionTransform.parent = this.laserPointer;

        // Create a depiction of the user in the WIM
        var WIMCamera = MeshBuilder.CreateBox("UserMini", { size: 1 }, this.scene);
        WIMCamera.position = this.xrCamera.position;
        WIMCamera.isVisible = false;
        var WIMCamMat = new StandardMaterial("WIMCamera_Material", this.scene);
        WIMCamMat.diffuseColor = Color3.Black();
        WIMCamMat.specularColor = Color3.Black();
        WIMCamMat.emissiveColor = Color3.Black();
        WIMCamera.material = WIMCamMat;

        this.createMiniature(WIMCamera);

        // Attach the laser pointer to the right controller when it is connected
        this.xrHelper.input.onControllerAddedObservable.add((inputSource) => {
            if(inputSource.uniqueId.endsWith("right"))
            {
                this.rightController = inputSource;               
                this.laserPointer!.parent = this.rightController.pointer;
                this.laserPointer!.visibility = 1;
            }
            else 
            {
                this.leftController = inputSource;

                var WIM_Children = this.WIM_Node.getChildMeshes();
                for (var mesh of WIM_Children) {
                    mesh.isVisible = true;
                }
                this.miniSkybox!.isVisible = true;

                // Attach the WIM to the less-dominant (left) controller
                this.WIM_Node.parent = this.leftController.pointer;

                inputSource.onMotionControllerInitObservable.add((controller) => {
                    controller.onModelLoadedObservable.add((mesh) => {
                        inputSource.motionController!.rootMesh!.dispose();
                    });
                });
            }
        });

        // Don't forget to deparent the laser pointer or it will be destroyed!
        this.xrHelper.input.onControllerRemovedObservable.add((inputSource) => {

            if(inputSource.uniqueId.endsWith("right")) 
            {
                this.laserPointer!.parent = null;
                this.laserPointer!.visibility = 0;
            }
        });

        // Create the Menuing System
        //this.CreateGUI();

        // Enable physics engine with gravity
        this.scene.enablePhysics(new Vector3(0, -9.8, 0), new CannonJSPlugin(undefined, undefined, Cannon));

        // Create Materials
        this.createMaterials();

        // Create a building for destruction
        this.createBuilding();
        this.Building_Node.position = new Vector3(-15, 5, 15);
        this.Building_Node.getChildMeshes().forEach((mesh) => {
            this.createMiniature(<Mesh>mesh);
        });
        this.Building_Node.scaling.y = 5;

        // Load External Assets (Meshes and Sounds)
        this.loadExternalAssets();

        this.WIM_Node.scaling = new Vector3(this.WIMScaleFactor, this.WIMScaleFactor, this.WIMScaleFactor);
        this.DeactivateWIM();

        this.scene.debugLayer.show(); 
    }

    // The main update loop will be executed once per frame before the scene is rendered
    private update() : void
    {
        if(this.leftController && this.rightController)
        {
            // Update bimanual line position and rotation
            this.bimanualLine!.position = this.leftController.grip!.position;
            this.bimanualLine!.lookAt(this.rightController.grip!.position);

            // Update bimanual line scale
            this.bimanualLine!.scaling.z = this.rightController.grip!.position.subtract(this.leftController.grip!.position).length();
        }

        // Polling for controller input
        this.processControllerInput();  

        // Check the position of the controllers
        this.checkControllerPositions();

        // Update the user position

        // Check for collision with building

        // Update objects in the WIM
        if (this.selectedObject) {
            this.updateMiniature(this.selectedObjectIndex!);
        }

        this.updateMiniUser();

        // Update the previous controller positions for next frame
        if(this.rightController)
        {
            this.previousRightControllerPosition = this.rightController.grip!.position.clone();
        }
        if(this.leftController)
        {
            this.previousLeftControllerPosition = this.leftController.grip!.position.clone();
        }
    }

    // Need to update the position/orientation of the Mini User
    private updateMiniUser() {
        this.WIMObjects[0].rotationQuaternion = this.xrCamera!.rotationQuaternion;
    }

    // Process event handlers for controller input
    private processControllerInput()
    {
        this.onRightTrigger(this.rightController?.motionController?.getComponent("xr-standard-trigger"));
        this.onRightThumbstick(this.rightController?.motionController?.getComponent("xr-standard-thumbstick"));
        this.onRightSqueeze(this.rightController?.motionController?.getComponent("xr-standard-squeeze"));
        this.onLeftSqueeze(this.leftController?.motionController?.getComponent("xr-standard-squeeze"));
    }

    private onRightTrigger(component?: WebXRControllerComponent)
    {  
        if(component?.changes.pressed)
        {
            if(component?.pressed)
            {
                this.laserPointer!.color = Color3.Green();

                var ray = new Ray(this.rightController!.pointer.position, this.rightController!.pointer.forward, 10);
                var pickInfo = this.scene.pickWithRay(ray);

                // Deselect the currently selected object 
                if(this.selectedObject)
                {
                    this.selectedObject.disableEdgesRendering();
                    this.selectedObject = null;
                    this.selectedObjectIndex = null;
                }

                // If an object was hit, select it
                if (pickInfo ?.hit && this.largeObjects.includes(<Mesh>pickInfo!.pickedMesh))
                {
                    this.selectedObject = pickInfo!.pickedMesh;
                    this.selectedObject!.enableEdgesRendering();
                    this.selectedObjectIndex = this.largeObjects.indexOf(<Mesh>this.selectedObject) + 1;

                    if (this.selectedObject!.name != "Handle" && this.selectedObject!.name != "Handle_copy") {
                        // Parent the object to the transform on the laser pointer
                        this.selectionTransform!.position = new Vector3(0, 0, pickInfo.distance);
                        this.selectedObject!.setParent(this.selectionTransform!);
                    }
                }
            }
            else
            {
                // Reset the laser pointer color
                this.laserPointer!.color = Color3.Blue();

                // Release the object from the laser pointer
                if(this.selectedObject)
                {
                    this.selectedObject!.setParent(null);
                }  
            }
        }
    }

    private onRightThumbstick(component?: WebXRControllerComponent)
    {
        // If we have an object that is currently attached to the laser pointer
        if (component ?.changes.axes && this.selectedObject && this.selectedObject.parent) {
            // Use delta time to calculate the proper speed
            var moveDistance = -component.axes.y * (this.engine.getDeltaTime() / 1000) * 3;

            // Translate the object along the depth ray in world space
            this.selectedObject.translate(this.laserPointer!.forward, moveDistance, Space.WORLD);
        } else if (component ?.changes.axes) {
            if (component ?.axes.y < -.75) { // If the thumbstick is moved forward               
                // Create a new ray cast
                var ray = new Ray(this.rightController!.pointer.position, this.rightController!.pointer.forward, 20);
                var pickInfo = this.scene.pickWithRay(ray);

                // If the ray cast intersected a ground mesh
                if (pickInfo ?.hit && this.miniSkybox!.getChildMeshes().includes(pickInfo.pickedMesh!)) {
                    pickInfo!.pickedMesh!.setParent(this.WIM_Node);
                    this.teleportPoint = pickInfo.pickedPoint;

                    this.teleportMarker.rotation = Vector3.Zero();
                    this.laserPointer!.scaling.z = pickInfo.distance;
                    this.laserPointer!.visibility = 1;

                    for (var mesh of this.teleportMarker.getChildMeshes()) {
                        mesh.visibility = 1;
                    }

                    this.teleportMarker.position.x = this.teleportPoint!.x;
                    this.teleportMarker.position.y = 1;
                    this.teleportMarker.position.z = this.teleportPoint!.z;

                    // Use the distance between the two controllers to determine the angle
                    this.teleportAngle = (Vector3.Distance(this.leftController!.pointer!.position, this.rightController!.pointer!.position) / 1) * 360 * (Math.PI / 90);

                    this.teleportMarker.setParent(this.rightController!.pointer!);
                    this.teleportMarker.rotation.y = this.teleportAngle - (Math.PI / 2);
                    this.teleportMarker.setParent(null);
                    this.teleportMarker.rotation.x = 0;
                    this.teleportMarker.rotation.z = 0;

                    pickInfo!.pickedMesh!.setParent(null);
                } else {
                    this.teleportPoint = null;
                    this.laserPointer!.visibility = 0;

                    for (var mesh of this.teleportMarker.getChildMeshes()) {
                        mesh.visibility = 0;
                    }
                }
            }
            // If thumbstick returns to the rest position
            else if (component ?.axes.y == 0) {
                this.laserPointer!.visibility = 0;
                for (var mesh of this.teleportMarker.getChildMeshes()) {
                    mesh.visibility = 0;
                }

                // If we have a valid targer point, then teleport the user
                if (this.teleportPoint) {
                    this.xrCamera!.position.x = this.teleportPoint.x / this.WIMScaleFactor;
                    this.xrCamera!.position.y = (this.teleportPoint.y + this.xrCamera!.realWorldHeight) / this.WIMScaleFactor;
                    this.xrCamera!.position.z = this.teleportPoint.z / this.WIMScaleFactor;

                    this.teleportMarker.setParent(this.xrCamera);
                    var cameraRotation = Quaternion.FromEulerAngles(0, this.teleportMarker.rotation.y + (Math.PI / 2), 0);
                    this.xrCamera!.rotationQuaternion.multiplyInPlace(cameraRotation);
                    this.xrCamera!.updateUpVectorFromRotation = false;
                    this.teleportMarker.setParent(null);
                    this.teleportPoint = null;

                }
            }
        }
    }

    private onRightSqueeze(component?: WebXRControllerComponent)
    {
        if(this.selectedObject && this.leftController)
        {
            if (this.selectedObject.name != "Handle" && this.selectedObject.name != "Handle_copy") {
                if (component ?.changes.pressed) {
                    // Button down
                    if (component ?.pressed) {
                        this.bimanualLine!.visibility = 1;
                        this.miniatureObject = new InstancedMesh('miniatureObject', <Mesh>this.selectedObject);
                    }
                    // Button release
                    else {
                        this.bimanualLine!.visibility = 0;
                        this.miniatureObject ?.dispose();
                    }
                }

                if (component ?.pressed) {
                    // Position manipulation
                    var midpoint = this.rightController!.grip!.position.add(this.leftController.grip!.position).scale(.5);
                    var previousMidpoint = this.previousRightControllerPosition.add(this.previousLeftControllerPosition).scale(.5);
                    var positionChange = midpoint.subtract(previousMidpoint);
                    this.selectedObject.translate(positionChange!.normalizeToNew(), positionChange.length(), Space.WORLD);

                    // Rotation manipulation
                    var bimanualVector = this.rightController!.grip!.position.subtract(this.leftController!.grip!.position).normalize();
                    var previousBimanualVector = this.previousRightControllerPosition.subtract(this.previousLeftControllerPosition).normalize();

                    // Some linear algebra to calculate the angle and axis of rotation
                    var angle = Math.acos(Vector3.Dot(previousBimanualVector, bimanualVector));
                    var axis = Vector3.Cross(previousBimanualVector, bimanualVector).normalize();
                    this.selectedObject.rotate(axis, angle, Space.WORLD);

                    // Update the position, orientation, and scale of the miniature object
                    this.miniatureObject!.position = midpoint;
                    this.miniatureObject!.rotationQuaternion = this.selectedObject.absoluteRotationQuaternion;
                    this.miniatureObject!.scaling = this.selectedObject.scaling.scale(.1);
                }
            }
        }
    }

    private onLeftSqueeze(component?: WebXRControllerComponent)
    {
        // Only add scale manipulation if the right squeeze button is already being pressed
        if(component?.pressed && this.selectedObject &&
            this.rightController?.motionController?.getComponent("xr-standard-squeeze").pressed)
        {
            if (this.selectedObject.name != "Handle" && this.selectedObject.name != "Handle_copy") {
                // Scale manipulation
                var bimanualVector = this.rightController!.grip!.position.subtract(this.leftController!.grip!.position);
                var previousBimanualVector = this.previousRightControllerPosition.subtract(this.previousLeftControllerPosition);
                var scaleFactor = bimanualVector.length() / previousBimanualVector.length();
                this.selectedObject.scaling = this.selectedObject.scaling.scale(scaleFactor);
            }
        }
    }

    // Create the different material options for the building
    private createMaterials() {
        var blueEmissiveMaterial = new StandardMaterial("blueMaterial", this.scene);
        blueEmissiveMaterial.diffuseColor = new Color3(.284, .73, .831);
        blueEmissiveMaterial.specularColor = Color3.Black();
        blueEmissiveMaterial.emissiveColor = new Color3(.284, .73, .831);
        this.Materials.push(blueEmissiveMaterial);

        var brickRedMaterial = new StandardMaterial("brickRedMaterial", this.scene);
        brickRedMaterial.diffuseColor = new Color3(128 / 255, 2 / 255, 2 / 255);
        brickRedMaterial.specularColor = Color3.Black();
        brickRedMaterial.emissiveColor = new Color3(92 / 255, 3 / 255, 3 / 255);
        this.Materials.push(brickRedMaterial);
    }

    // Create a building for destruction
    private createBuilding() {
        for (let length = 0; length < 5; length++) {
            for (let width = 0; width < 5; width++) {
                for (let height = 0; height < 5; height++) {
                    let cube = MeshBuilder.CreateBox("cube", { size: 1 }, this.scene);
                    cube.scaling.y = 3
                    cube.position = new Vector3(length, height + 0.5, width);
                    cube.material = this.Materials[this.MaterialIndex];
                    cube.edgesWidth = .3;
                   
                    cube.physicsImpostor = new PhysicsImpostor(cube, PhysicsImpostor.BoxImpostor, { mass: this.cubeMass }, this.scene);
                    cube.physicsImpostor!.setLinearVelocity(Vector3.Zero());
                    cube.physicsImpostor!.sleep();

                    cube.parent = this.Building_Node;
                    this.largeObjects.push(cube);
                }
            }
        }
    }

    // Load external meshes and sounds
    private loadExternalAssets() {
        var assetsManager = new AssetsManager(this.scene);

        // Load the wrecking ball vehicle
        var vehicleMesh_Task = assetsManager.addMeshTask("vehicleMesh", "", "assets/models/mining-dump-truck/", "mining-dump-truck.babylon");
        vehicleMesh_Task.onSuccess = (task) => {
            vehicleMesh_Task.loadedMeshes.forEach((mesh) => {
                mesh.parent = this.Vehicle_Node;
                mesh.isPickable = false;
                (<StandardMaterial>mesh.material!).emissiveColor = Color3.White();
                this.Vehicle_Meshes.push(<Mesh>mesh);
                this.largeObjects.push(<Mesh>mesh);
                mesh.visibility = 0;
            });
        }

        var lever_Task = assetsManager.addMeshTask("leverMesh", "", "assets/models/", "lever.babylon");
        lever_Task.onSuccess = ((task) => {
            lever_Task.loadedMeshes.forEach((mesh) => {
                mesh.parent = this.leftLever_Node;
                mesh.material = this.Materials[1];
                if (mesh.name != "Handle") {
                    mesh.isPickable = false;
                }
                var copyMesh = new InstancedMesh(mesh.name + "_copy", <Mesh>mesh);
                copyMesh.parent = this.rightLever_Node;
                if (copyMesh.name != "Handle_copy") {
                    copyMesh.isPickable = false;
                }
                this.Vehicle_Meshes.push(<Mesh>mesh);
                this.largeObjects.push(<Mesh>mesh);                
                mesh.visibility = 0;
            });
        });

        // Load the teleportation marker
        var teleportMarkerTask = assetsManager.addMeshTask("teleportaion marker task", "", "assets/models/", "arrow.babylon");
        teleportMarkerTask.onSuccess = (task) => {
            teleportMarkerTask.loadedMeshes.forEach((mesh) => {
                mesh.parent = this.teleportMarker;
                mesh.visibility = 0;
            });

            this.teleportMarker.parent = this.WIM_Node;
        };

        // This loads all the assets and displays a loading screen
        assetsManager.load();

        // Build the vehicle
        this.leftLever_Node.position = new Vector3(-0.4, 5.29, 7.12);
        this.leftLever_Node.rotation = new Vector3(0, Math.PI / 2, 0);
        this.leftLever_Node.scaling = new Vector3(0.01, 0.02, 0.01);

        this.rightLever_Node.position = new Vector3(0.4, 5.29, 7.12);
        this.rightLever_Node.rotation = new Vector3(0, Math.PI / 2, 0);
        this.rightLever_Node.scaling = new Vector3(0.01, 0.02, 0.01);

        this.Vehicle_Node.position = new Vector3(0, -1.2, 0);
        this.Vehicle_Node.rotation = new Vector3(0, Math.PI, 0);
        this.Vehicle_Node.scaling = new Vector3(0.05, 0.05, 0.05);

        this.leftLever_Node.setParent(this.Vehicle_Node);
        this.rightLever_Node.setParent(this.Vehicle_Node);

        this.Vehicle_Meshes.forEach((mesh) => {
            this.createMiniature(<Mesh>mesh);
        });
    }

    // The GUI will be placed on the left hand
    private CreateGUI() {

        /* Manually create a plane for the menuing system
        var staticTextPlane = MeshBuilder.CreatePlane("textPlane", {}, this.scene);
        staticTextPlane.position.y = .1;

        // Create a dynamic texture for adding the GUI controls
        var staticTextTexture = AdvancedDynamicTexture.CreateForMesh(staticTextPlane, 512, 512);

        // Create a static text block
        var staticText = new TextBlock();
        staticText.text = "Text Here";
        staticText.color = "white";
        staticText.fontSize = 12;
        staticTextTexture.addControl(staticText);

        // Attach the menu to the left controller when it is connected
        this.xrHelper!.input.onControllerAddedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                staticTextPlane.parent = this.rightController!.pointer!;
            }
        });

        // Don't forget to deparent the laser pointer or it will be destroyed!
        this.xrHelper!.input.onControllerRemovedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                staticTextPlane.parent = null;
            }
        }); */

        // The manager automates some of the GUI creation steps
        var guiManager = new GUI3DManager(this.scene);

        // Create buttons
        var materialsButton = new Button3D("materialsButton");
        var physicsButton = new Button3D("physicsButton");
        var WIMButton = new Button3D("WIMButton");
   
        guiManager.addControl(materialsButton);
        //guiManager.addControl(physicsButton);
        //guiManager.addControl(WIMButton);

        // Materials Button
        materialsButton.scaling.y = 0.5;
        materialsButton.mesh!.parent = this.GUI_Node;

        var materialsButtonText = new TextBlock();
        materialsButtonText.text = "Building Material";
        materialsButtonText.color = "white";
        materialsButtonText.fontSize = 24;
        materialsButtonText.scaleY = 2;
        materialsButton.content = materialsButtonText;

        /* Physics Button
        physicsButton.scaling.y = 0.5;
        physicsButton.mesh!.parent = this.GUI_Node;

        // WIM Button
        WIMButton.scaling.y = 0.5;
        WIMButton.mesh!.parent = this.GUI_Node;
        */

        // Attach the menu to the left controller when it is connected
        this.xrHelper!.input.onControllerAddedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                this.GUI_Node.parent = this.leftController!.pointer!;
            }
        });

        // Don't forget to deparent the menu pointer or it will be destroyed!
        this.xrHelper!.input.onControllerRemovedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                this.GUI_Node.parent = null;
            }
        });
    } 

    // Check the controller positions to toggle the menu/vehicle modes
    private checkControllerPositions() {
        // Ensure that the controllers are connected
        if (this.leftController && this.rightController) {

            // Vehicle Toggle
            // Check if the controller positions are above the headset
            if (this.leftController!.grip!.position.y >= this.xrCamera!.position.y &&
                this.rightController!.grip!.position.y >= this.xrCamera!.position.y) {
                // Ensure that this is the first time that the controllers are above the headset
                if (this.VehicleSwitchEnabled) {
                    if (this.Vehicle_Active) {
                        this.ExitVehicleMode();
                    } else {
                        this.EnterVehicleMode();
                    }

                    this.VehicleSwitchEnabled = false;
                }
            } else {
                this.VehicleSwitchEnabled = true;
            }

            // Menu Toggle
            // Check if the controller positions are crossed
            this.leftController!.grip!.setParent(this.xrCamera!);
            this.rightController!.grip!.setParent(this.xrCamera!);
            if (this.leftController!.grip!.position.x >= this.rightController!.grip!.position.x) {
                // Ensure that this is the first time that the controllers are crossed
                if (this.GUISwitchEnabled) {
                    if (this.GUI_Active) {
                        this.DisableMenu();
                    } else {
                        this.ActivateMenu();
                    }

                    this.GUISwitchEnabled = false;
                }
            } else {
                this.GUISwitchEnabled = true;
            }
            this.leftController!.grip!.setParent(null);
            this.rightController!.grip!.setParent(null);
        }
    }

    // Enable the menu
    private ActivateMenu() {
        // Make the GUI visible
        this.ActivateWIM();

        // Make the left controller invisible
        this.leftController!.pointer!.getChildMeshes().forEach((mesh) => {
            mesh.visibility = 0;
        });

        this.GUI_Active = true;
    }

    // Disable the menu
    private DisableMenu() {
        // Make the GUI invisible
        this.DeactivateWIM();

        // Make the left controller visible again
        this.leftController!.pointer!.getChildMeshes().forEach((mesh) => {
            mesh.visibility = 1;
        });

        this.GUI_Active = false;
    }

    // Enter the vehicle
    private EnterVehicleMode() {
        this.Vehicle_Meshes.forEach((mesh) => {
            mesh.visibility = 1;
        });

        this.xrCamera!.position = new Vector3(0, this.xrCamera!.realWorldHeight + 5.5, 6.3);

        this.Vehicle_Active = true;
    }

    // Exit the vehicle
    private ExitVehicleMode() {
        this.Vehicle_Meshes.forEach((mesh) => {
            mesh.visibility = 0;
        });

        this.xrCamera!.position = new Vector3(0, this.xrCamera!.realWorldHeight, 0);

        this.Vehicle_Active = false;
    }

    // Activate the WIM
    private ActivateWIM() {
        this.miniSkybox!.visibility = 1;

        this.largeObjects.forEach((mesh) => {
            var meshIndex = this.largeObjects.indexOf(mesh);
            this.WIMObjects[meshIndex + 1].visibility = mesh.visibility;
        });
    }

    // Deactivate the WIM
    private DeactivateWIM() {
        this.miniSkybox!.visibility = 0;

        this.WIMObjects.forEach((mesh) => {
            mesh.visibility = 0;
        });
    }

    // Creates a miniture instance of the object specified for the WIM
    // Any modifications to the original Mesh also changes the InstancedMesh
    private createMiniature(mesh: Mesh) {
        var meshCopy = mesh.clone();
        meshCopy.name = mesh.name + "_mini";
        meshCopy.parent = this.WIM_Node;
        meshCopy.position = mesh.getAbsolutePosition().clone();
        if (mesh.name == "cube") {
            meshCopy.scaling.y = 5;
        }
        meshCopy.edgesWidth = .1;
        meshCopy.visibility = mesh.visibility;

        this.WIMObjects.push(meshCopy);
    }

    private updateMiniature(i: int) {
        this.WIMObjects[i].position = this.selectedObject!.getAbsolutePosition().clone();
        this.WIMObjects[i].rotationQuaternion = this.selectedObject!.absoluteRotationQuaternion;
    }
}
/******* End of the Game class ******/   

// start the game
var game = new Game();
game.start();