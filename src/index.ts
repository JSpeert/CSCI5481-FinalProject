/* CSCI 5619 Lecture 13, Fall 2020
 * Author: Evan Suma Rosenberg
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Color4, Space } from "@babylonjs/core/Maths/math";
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
import { PlanePanel } from "@babylonjs/gui/3D/controls/planePanel";
import { WebXRExperienceHelper } from "@babylonjs/core/XR/webXRExperienceHelper";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Slider } from "@babylonjs/gui/2D/controls/sliders/slider";
import { Control } from "@babylonjs/gui/2D/controls/control";

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
    private GUI_NavBar_Node: TransformNode;
    private GUI_NavBarButtons: Button3D[];
    private GUI_MaterialsPage: TransformNode;
    private GUI_PhysicsPage: TransformNode;
    private selectedObject_right: AbstractMesh | null;
    private selectedObject_left: AbstractMesh | null;
    private selectionTransform_right: TransformNode | null;
    private selectionTransform_left: TransformNode | null;

    private laserPointer_right: LinesMesh | null;
    private laserPointer_left: LinesMesh | null;
    private bimanualLine: LinesMesh | null;
    private miniatureObject: InstancedMesh | null;

    private previousLeftControllerPosition: Vector3;
    private previousRightControllerPosition: Vector3;

    private Building_Node: TransformNode;
    private Vehicle_Node: TransformNode;
    private Vehicle_Meshes: Mesh[];
    private leftLever_Node: TransformNode;
    private rightLever_Node: TransformNode;
    private leftLeverHandle_Node: TransformNode;
    private rightLeverHandle_Node: TransformNode;
    private camera_Node: TransformNode;
    private GoalPlane: Mesh | null;

    // Values to be toggled
    private GUI_Active: Boolean;
    private MaterialsPage_Active: Boolean;
    private PhysicsPage_Active: Boolean;
    private GUISwitchEnabled: Boolean;
    private Vehicle_Active: Boolean;
    private VehicleSwitchEnabled: Boolean;
    private DestructionActive: Boolean;
    private rightLeverStart: Vector3 | null;
    private leftLeverStart: Vector3 | null;
    private Materials: Material[];
    private MaterialIndex: int;
    private cubeMass: float;
    private vehicleSpeed: float;
    private vehicleTurningSpeed: float;

    // Sounds
    private buttonClick1_Sound: Sound | null;
    private buttonClick2_Sound: Sound | null;
    private vehicleMode_Sound: Sound | null;
    private vehicleMotion_Sound: Sound | null;
    private menuEnter_Sound: Sound | null;
    private menuExit_Sound: Sound | null;
    private explosion_Sound: Sound | null;

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
    
        this.selectedObject_right = null;
        this.selectedObject_left = null;
        this.selectionTransform_right = null;
        this.selectionTransform_left = null;
        this.selectedObject_left = null;
        this.laserPointer_right = null;
        this.laserPointer_left = null;
        this.bimanualLine = null;
        this.miniatureObject = null;

        this.previousLeftControllerPosition = Vector3.Zero();
        this.previousRightControllerPosition = Vector3.Zero();

        this.Building_Node = new TransformNode("Building", this.scene);

        this.Vehicle_Node = new TransformNode("Vehicle", this.scene);
        this.Vehicle_Meshes = [];
        this.leftLever_Node = new TransformNode("LeftLever", this.scene);
        this.rightLever_Node = new TransformNode("RightLever", this.scene);
        this.leftLeverHandle_Node = new TransformNode("LeftLeverHandle", this.scene);
        this.leftLeverHandle_Node.parent = this.leftLever_Node;
        this.rightLeverHandle_Node = new TransformNode("RightLeverHandle", this.scene);
        this.rightLeverHandle_Node.parent = this.rightLever_Node;
        this.camera_Node = new TransformNode("CameraNode", this.scene);
        this.GoalPlane = null;

        this.GUI_Node = new TransformNode("GUI", this.scene);
        this.GUI_NavBarButtons = [];
        this.GUI_NavBar_Node = new TransformNode("NavBar", this.scene);
        this.GUI_NavBar_Node.parent = this.GUI_Node;
        this.GUI_MaterialsPage = new TransformNode("MaterialsPage", this.scene);
        this.GUI_MaterialsPage.parent = this.GUI_Node;
        this.GUI_PhysicsPage = new TransformNode("PhysicsPage", this.scene);
        this.GUI_PhysicsPage.parent = this.GUI_Node;

        this.GUI_Active = false;
        this.MaterialsPage_Active = false;
        this.PhysicsPage_Active = false;
        this.GUISwitchEnabled = true;
        this.Vehicle_Active = false;
        this.VehicleSwitchEnabled = true;
        this.DestructionActive = false;
        this.rightLeverStart = null;
        this.leftLeverStart = null;
        this.Materials = [];
        this.MaterialIndex = 0;
        this.cubeMass = 1;
        this.vehicleSpeed = 3.0;
        this.vehicleTurningSpeed = 1.0;

        this.buttonClick1_Sound = null;
        this.buttonClick2_Sound = null;
        this.vehicleMode_Sound = null;
        this.vehicleMotion_Sound = null;
        this.menuEnter_Sound = null;
        this.menuExit_Sound = null;
        this.explosion_Sound = null;
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

        // Creates the XR experience helper
        this.xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Assigns the web XR camera to a member variable
        this.xrCamera = this.xrHelper.baseExperience.camera;
        //this.xrCamera.parent = this.camera_Node;

        // Remove default teleportation and pointer selection
       this.xrHelper.teleportation.dispose();

        // Create points for the laser pointer
        var laserPoints = [];
        laserPoints.push(new Vector3(0, 0, 0));
        laserPoints.push(new Vector3(0, 0, 10));

        // Create laser pointers and make sure they're not pickable
        this.laserPointer_right = MeshBuilder.CreateLines("laserPointer_right", {points: laserPoints}, this.scene);
        this.laserPointer_right.color = Color3.Blue();
        this.laserPointer_right.alpha = .5;
        this.laserPointer_right.visibility = 0;
        this.laserPointer_right.isPickable = false;

        this.laserPointer_left = MeshBuilder.CreateLines("laserPointer_left", { points: laserPoints }, this.scene);
        this.laserPointer_left.color = Color3.Blue();
        this.laserPointer_left.alpha = .5;
        this.laserPointer_left.visibility = 0;
        this.laserPointer_left.isPickable = false;

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
        this.selectionTransform_right = new TransformNode("selectionTransform_Right", this.scene);
        this.selectionTransform_left = new TransformNode("selectionTransform_Left", this.scene);
        this.selectionTransform_right.parent = this.laserPointer_right;
        this.selectionTransform_left.parent = this.laserPointer_left;

        // Attach the laser pointer to the right controller when it is connected
        this.xrHelper.input.onControllerAddedObservable.add((inputSource) => {
            if(inputSource.uniqueId.endsWith("right"))
            {               
                this.rightController = inputSource;               
                this.laserPointer_right!.parent = this.rightController.pointer;
                this.laserPointer_right!.visibility = 1;
            }
            else 
            {
                this.leftController = inputSource;
                this.laserPointer_left!.parent = this.leftController.pointer;
                this.laserPointer_left!.visibility = 1;

                // Attach the WIM to the less-dominant (left) controller
                this.GUI_Node.setParent(this.leftController.pointer);
                this.GUI_Node.getChildMeshes().forEach((mesh) => {
                    mesh.isPickable = false;
                    mesh.visibility = 0;
                });
            }
        });

        // Don't forget to deparent the laser pointer or it will be destroyed!
        this.xrHelper.input.onControllerRemovedObservable.add((inputSource) => {

            if (inputSource.uniqueId.endsWith("right")) {
                this.laserPointer_right!.parent = null;
                this.laserPointer_right!.visibility = 0;
            } else {
                this.laserPointer_left!.parent = null;
                this.laserPointer_left!.visibility = 0;

                this.GUI_Node.setParent(null);
                this.GUI_Node.getChildMeshes().forEach((mesh) => {
                    mesh.visibility = 0;
                });
            }
        });

        // Create Materials
        this.createMaterials();

        // Create the Menuing System
        this.CreateGUI();
        this.DisableMenu();

        // Enable physics engine with gravity
        this.scene.enablePhysics(new Vector3(0, -9.8, 0), new CannonJSPlugin(undefined, undefined, Cannon));

        // Create a building for destruction
        this.createBuilding();
        this.Building_Node.position = new Vector3(-15, 0.65, 15);        
        this.Building_Node.scaling.y = 5;

        // Load External Assets (Meshes and Sounds)
        this.loadExternalAssets();  

        // Create an indication of the goal position
        this.GoalPlane = MeshBuilder.CreatePlane("Goal", { width: 5, height: 5 }, this.scene);
        this.GoalPlane.position.y = 3;
        this.GoalPlane.position.z = 5;

        var GoalPlaneMaterial = new StandardMaterial("GoalPlane", this.scene);
        GoalPlaneMaterial.diffuseColor = new Color3(226/255, 0, 0);
        GoalPlaneMaterial.alpha = .5;
        this.GoalPlane.material = GoalPlaneMaterial;

        var GPDyanimcTexture = AdvancedDynamicTexture.CreateForMesh(this.GoalPlane, 1500, 1500);
        GPDyanimcTexture.background = "red";

        var DriveHereText = new TextBlock();
        DriveHereText.text = "Drive Here to Activate the Destruction Button in the Menu";
        DriveHereText.color = "white";
        DriveHereText.fontSize = 50;
        GPDyanimcTexture.addControl(DriveHereText);

        //this.scene.debugLayer.show(); 
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

        // Check the user position

        // Update the vehicle
        if (this.Vehicle_Active) {
            this.DriveVehicle();
        }

        // Check for collision with building
        // If the user is within the goal-space, activate the Destruction Button
        if (this.xrCamera!.position.z > this.GoalPlane!.getAbsolutePosition().z) {
            this.DestructionActive = true;
            if (this.GoalPlane) {
                this.GoalPlane!.dispose();
            }
        }

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

    // Process event handlers for controller input
    private processControllerInput()
    {
        this.onRightTrigger(this.rightController ?.motionController ?.getComponent("xr-standard-trigger"));
        this.onLeftTrigger(this.leftController ?.motionController ?.getComponent("xr-standard-trigger"));
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
                this.laserPointer_right!.color = Color3.Green();

                var ray = new Ray(this.rightController!.pointer.position, this.rightController!.pointer.forward, 10);
                var pickInfo = this.scene.pickWithRay(ray);

                // Deselect the currently selected object 
                if(this.selectedObject_right)
                {
                    this.selectedObject_right.disableEdgesRendering();
                    this.selectedObject_right = null;
                }

                // If an object was hit, select it
                if (pickInfo ?.hit)
                {
                    this.selectedObject_right = pickInfo!.pickedMesh;            

                    if (this.selectedObject_right!.name != "Handle" && this.selectedObject_right!.name != "Handle_copy" && this.selectedObject_right!.name != "PhysicsPanel") {
                        this.selectedObject_right!.enableEdgesRendering();

                        // Parent the object to the transform on the laser pointer
                        this.selectionTransform_right!.position = new Vector3(0, 0, pickInfo.distance);
                        this.selectedObject_right!.setParent(this.selectionTransform_right!);
                    } else if (this.selectedObject_right!.name == "Handle_copy") {
                        this.selectedObject_right!.enableEdgesRendering();
                        this.rightController!.grip!.setParent(this.xrCamera);
                        this.rightLeverStart = this.rightController!.grip!.position.clone();
                        this.rightController!.grip!.setParent(null);                       
                    }
                }
            }
            else
            {
                // Reset the laser pointer color
                this.laserPointer_right!.color = Color3.Blue();

                // Release the object from the laser pointer
                if(this.selectedObject_right)
                {
                    if (this.selectedObject_right!.name != "PhysicsPanel") {
                        this.selectedObject_right!.setParent(null);
                    }

                    if (this.selectedObject_right!.name == "Handle_copy") {
                        this.selectedObject_right.disableEdgesRendering();
                        this.selectedObject_right.setParent(this.rightLeverHandle_Node);
                        this.selectedObject_right = null;
                        this.rightLeverStart = null;
                        this.rightLeverHandle_Node.rotation.z = 0;
                    }
                }  
            }
        }
    }

    private onLeftTrigger(component?: WebXRControllerComponent) {
        if (this.GUI_Active == false) {
            if (component ?.changes.pressed) {
                if (component ?.pressed) {
                    this.laserPointer_left!.color = Color3.Green();

                    var ray = new Ray(this.leftController!.pointer.position, this.leftController!.pointer.forward, 10);
                    var pickInfo = this.scene.pickWithRay(ray);

                    // Deselect the currently selected object 
                    if (this.selectedObject_left) {
                        this.selectedObject_left.disableEdgesRendering();
                        this.selectedObject_left = null;
                    }

                    // If an object was hit, select it
                    if (pickInfo ?.hit) {
                        this.selectedObject_left = pickInfo!.pickedMesh;                        

                        if (this.selectedObject_left!.name != "Handle" && this.selectedObject_left!.name != "Handle_copy" && this.selectedObject_left!.name != "PhysicsPanel") {
                            this.selectedObject_left!.enableEdgesRendering();

                            // Parent the object to the transform on the laser pointer
                            this.selectionTransform_left!.position = new Vector3(0, 0, pickInfo.distance);
                            this.selectedObject_left!.setParent(this.selectionTransform_left!);
                        } else if (this.selectedObject_left!.name == "Handle") {
                            this.selectedObject_left!.enableEdgesRendering();
                            this.leftController!.grip!.setParent(this.xrCamera!);
                            this.leftLeverStart = this.leftController!.grip!.position.clone();
                            this.leftController!.grip!.setParent(null);
                        }
                    }
                }
                else {
                    // Reset the laser pointer color
                    this.laserPointer_left!.color = Color3.Blue();

                    // Release the object from the laser pointer
                    if (this.selectedObject_left) {
                        this.selectedObject_left!.setParent(null);

                        if (this.selectedObject_left!.name == "Handle") {                       
                            this.selectedObject_left.disableEdgesRendering();
                            this.selectedObject_left.setParent(this.leftLeverHandle_Node);
                            this.selectedObject_left = null;
                            this.leftLeverHandle_Node.rotation.z = 0;
                            this.leftLeverStart = null;
                        }
                    }
                }
            }
        }
    }

    private onRightThumbstick(component?: WebXRControllerComponent)
    {
        // If we have an object that is currently attached to the laser pointer
        if (component ?.changes.axes && this.selectedObject_right && this.selectedObject_right.parent && this.selectedObject_right.name != "Handle_copy") {
            // Use delta time to calculate the proper speed
            var moveDistance = -component.axes.y * (this.engine.getDeltaTime() / 1000) * 3;

            // Translate the object along the depth ray in world space
            this.selectedObject_right.translate(this.laserPointer_right!.forward, moveDistance, Space.WORLD);
        } 
    }

    private onLeftThumbstick(component?: WebXRControllerComponent) {
        // If we have an object that is currently attached to the laser pointer
        if (component ?.changes.axes && this.selectedObject_left && this.selectedObject_left.parent && this.selectedObject_left.name != "Handle") {
            // Use delta time to calculate the proper speed
            var moveDistance = -component.axes.y * (this.engine.getDeltaTime() / 1000) * 3;

            // Translate the object along the depth ray in world space
            this.selectedObject_left.translate(this.laserPointer_left!.forward, moveDistance, Space.WORLD);
        }
    }

    private onRightSqueeze(component?: WebXRControllerComponent)
    {
        if(this.selectedObject_right && this.leftController)
        {
            if (this.selectedObject_right.name != "Handle" && this.selectedObject_right.name != "Handle_copy") {
                if (component ?.changes.pressed) {
                    // Button down
                    if (component ?.pressed) {
                        this.bimanualLine!.visibility = 1;
                        this.miniatureObject = new InstancedMesh('miniatureObject', <Mesh>this.selectedObject_right);
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
                    this.selectedObject_right.translate(positionChange!.normalizeToNew(), positionChange.length(), Space.WORLD);

                    // Rotation manipulation
                    var bimanualVector = this.rightController!.grip!.position.subtract(this.leftController!.grip!.position).normalize();
                    var previousBimanualVector = this.previousRightControllerPosition.subtract(this.previousLeftControllerPosition).normalize();

                    // Some linear algebra to calculate the angle and axis of rotation
                    var angle = Math.acos(Vector3.Dot(previousBimanualVector, bimanualVector));
                    var axis = Vector3.Cross(previousBimanualVector, bimanualVector).normalize();
                    this.selectedObject_right.rotate(axis, angle, Space.WORLD);

                    // Update the position, orientation, and scale of the miniature object
                    this.miniatureObject!.position = midpoint;
                    this.miniatureObject!.rotationQuaternion = this.selectedObject_right.absoluteRotationQuaternion;
                    this.miniatureObject!.scaling = this.selectedObject_right.scaling.scale(.1);
                }
            }
        }
    }

    private onLeftSqueeze(component?: WebXRControllerComponent)
    {
        // Only add scale manipulation if the right squeeze button is already being pressed
        if(component?.pressed && this.selectedObject_right &&
            this.rightController?.motionController?.getComponent("xr-standard-squeeze").pressed)
        {
            if (this.selectedObject_right.name != "Handle" && this.selectedObject_right.name != "Handle_copy") {
                // Scale manipulation
                var bimanualVector = this.rightController!.grip!.position.subtract(this.leftController!.grip!.position);
                var previousBimanualVector = this.previousRightControllerPosition.subtract(this.previousLeftControllerPosition);
                var scaleFactor = bimanualVector.length() / previousBimanualVector.length();
                this.selectedObject_right.scaling = this.selectedObject_right.scaling.scale(scaleFactor);
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

        for (var i = 0; i < 14; i++) {
            var material = new StandardMaterial("DefaultMaterial" + i, this.scene);
            material.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
            material.specularColor = new Color3(Math.random(), Math.random(), Math.random());
            material.emissiveColor = new Color3(Math.random(), Math.random(), Math.random());
            material.alpha = Math.random();
            if (material.alpha < 0.4) {
                material.alpha = 1;
            }
            this.Materials.push(material);
        }
    }

    // Create a building for destruction
    private createBuilding() {
        for (let length = 0; length < 5; length++) {
            for (let width = 0; width < 5; width++) {
                for (let height = 0; height < 5; height++) {
                    let cube = MeshBuilder.CreateBox("cube", { size: 1 }, this.scene);
                    cube.scaling.scale(1.5);
                    cube.position = new Vector3(length, height + 0.5, width);
                    cube.material = this.Materials[this.MaterialIndex];
                    cube.edgesWidth = .3;

                    cube.physicsImpostor = new PhysicsImpostor(cube, PhysicsImpostor.BoxImpostor, { mass: this.cubeMass }, this.scene);
                    cube.physicsImpostor!.setLinearVelocity(Vector3.Zero());
                    cube.physicsImpostor!.sleep();

                    cube.parent = this.Building_Node;
                }
            }
        }
    }

    // Load external meshes and sounds
    private loadExternalAssets() {
        var assetsManager = new AssetsManager(this.scene);

        // Load the vehicle
        var vehicleMesh_Task = assetsManager.addMeshTask("vehicleMesh", "", "assets/models/mining-dump-truck/", "mining-dump-truck.babylon");
        vehicleMesh_Task.onSuccess = (task) => {
            vehicleMesh_Task.loadedMeshes.forEach((mesh) => {
                mesh.parent = this.Vehicle_Node;
                mesh.isPickable = false;
                (<StandardMaterial>mesh.material!).emissiveColor = Color3.White();
                this.Vehicle_Meshes.push(<Mesh>mesh);
                mesh.visibility = 0;
            });
        }

        // Add the levers that will be used to steer the vehicle
        var lever_Task = assetsManager.addMeshTask("leverMesh", "", "assets/models/", "lever.babylon");
        lever_Task.onSuccess = ((task) => {
            lever_Task.loadedMeshes.forEach((mesh) => {               
                mesh.material = this.Materials[1];

                if (mesh.name != "Handle") {
                    mesh.parent = this.leftLever_Node;
                    mesh.isPickable = false;
                } else {
                    mesh.parent = this.leftLeverHandle_Node;                    
                }

                this.Vehicle_Meshes.push(<Mesh>mesh);

                mesh.visibility = 0;      

                // Create a copy of the lever mesh
                if (mesh.name == "Body" || mesh.name == "Handle") {
                    var copyMesh = mesh.clone(mesh.name + "_copy", null);
                    
                    if (copyMesh!.name != "Handle_copy") {
                        copyMesh!.parent = this.rightLever_Node;
                        copyMesh!.isPickable = false;
                    } else {
                        copyMesh!.parent = this.rightLeverHandle_Node;
                    }

                    this.Vehicle_Meshes.push(<Mesh>copyMesh);

                    copyMesh!.visibility = 0;
                }                      
            });
        });

        // Sounds
        var buttonClick1_Task = assetsManager.addBinaryFileTask("ButtonClick1Audio_Task", "assets/audio/ButtonClick1.mp3");
        buttonClick1_Task.onSuccess = ((task) => {
            this.buttonClick1_Sound = new Sound("ButtonClick1_Audio", task.data, this.scene, null, {
                loop: false,
                autoplay: false
            });
        });

        var buttonClick2_Task = assetsManager.addBinaryFileTask("ButtonClick2Audio_Task", "assets/audio/ButtonClick2.mp3");
        buttonClick2_Task.onSuccess = ((task) => {
            this.buttonClick2_Sound = new Sound("ButtonClick2_Audio", task.data, this.scene, null, {
                loop: false,
                autoplay: false
            });
        });

        var vehicleMode_Task = assetsManager.addBinaryFileTask("VehicleModeAudio_Task", "assets/audio/MuscleCar.mp3");
        vehicleMode_Task.onSuccess = ((task) => {
            this.vehicleMode_Sound = new Sound("VehicleMode_Audio", task.data, this.scene, null, {
                loop: true,
                autoplay: false
            });
        });

        var vehicleMotion_Task = assetsManager.addBinaryFileTask("VehicleMotionAudio_Task", "assets/audio/BackingUp.mp3");
        vehicleMotion_Task.onSuccess = ((task) => {
            this.vehicleMotion_Sound = new Sound("VehicleMotion_Audio", task.data, this.scene, null, {
                loop: true,
                autoplay: false
            });
        });

        var menuEnter_Task = assetsManager.addBinaryFileTask("MenuEnterAudio_Task", "assets/audio/MetroidDoor.mp3");
        menuEnter_Task.onSuccess = ((task) => {
            this.menuEnter_Sound = new Sound("MenuEnter_Audio", task.data, this.scene, null, {
                loop: false,
                autoplay: false
            });
        });

        var menuExit_Task = assetsManager.addBinaryFileTask("MenuExitAudio_Task", "assets/audio/MetroidDoor-Reversed.mp3");
        menuExit_Task.onSuccess = ((task) => {
            this.menuExit_Sound = new Sound("MenuExit_Audio", task.data, this.scene, null, {
                loop: false,
                autoplay: false,
            });
        });

        var explosion_Task = assetsManager.addBinaryFileTask("ExplosionAudio_Task", "assets/audio/Explosion.mp3");
        explosion_Task.onSuccess = ((task) => {
            this.explosion_Sound = new Sound("Explosion_Audio", task.data, this.scene, null, {
                loop: false,
                autoplay: false,
                spatialSound: true,
                distanceModel: "exponential",
                rolloffFactor: 2
            });

            this.explosion_Sound.setPosition(this.Building_Node.position);
        });

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

        this.camera_Node.parent = this.Vehicle_Node;
        this.camera_Node.position = new Vector3(0, 5.5, 6.3);
    }

    // The GUI will be placed on the left hand
    private CreateGUI() {

        this.GUI_Node.rotation.y = -Math.PI / 4;
        this.GUI_Node.scaling.scale(0.25);
        this.GUI_NavBar_Node.position.x = -0.25;
        this.GUI_MaterialsPage.position = new Vector3(.9, 0, 0);
        this.GUI_MaterialsPage.rotation.y = Math.PI / 4;
        this.GUI_PhysicsPage.position = new Vector3(.9, 0, 0);
        this.GUI_PhysicsPage.rotation.y = Math.PI / 4;

        // The manager automates some of the GUI creation steps
        var guiManager = new GUI3DManager(this.scene);

        // Create buttons
        var materialsButton = new Button3D("materialsButton");
        var physicsButton = new Button3D("physicsButton");
        var DestructionButton = new Button3D("DestructionButton");

        guiManager.addControl(materialsButton);
        guiManager.addControl(physicsButton);
        guiManager.addControl(DestructionButton);


        this.GUI_NavBarButtons.push(materialsButton);
        this.GUI_NavBarButtons.push(physicsButton);
        this.GUI_NavBarButtons.push(DestructionButton);

        // Materials Button
        materialsButton.position.y = 0.30;
        materialsButton.scaling = new Vector3(0.5, 0.125, 1);
        materialsButton.mesh!.parent = this.GUI_NavBar_Node;

        var materialsButtonText = new TextBlock();
        materialsButtonText.text = "Building Material";
        materialsButtonText.color = "white";
        materialsButtonText.fontSize = 14;
        materialsButtonText.scaleX = 2;
        materialsButtonText.scaleY = 4;
        materialsButton.content = materialsButtonText;

        materialsButton.onPointerDownObservable.add(() => {
            this.buttonClick1_Sound!.play();
            var materialButton_material = <StandardMaterial>materialsButton.mesh!.material;

            console.log(materialButton_material.diffuseColor);
            if (!this.MaterialsPage_Active) {
                this.GUI_MaterialsPage.getChildMeshes().forEach((mesh) => {
                    mesh.visibility = 1;
                    mesh.isPickable = true;
                });

                materialButton_material.diffuseColor = new Color3(.5, .5, .5);
                materialsButton.mesh!.scaling.z *= 0.5;

                if (this.PhysicsPage_Active) {
                    var physicsButton_material = <StandardMaterial>physicsButton.mesh!.material;
                    physicsButton_material.diffuseColor = new Color3(1, 1, 1);
                    physicsButton.mesh!.scaling.z *= 2;

                    this.GUI_PhysicsPage.getChildMeshes().forEach((mesh) => {
                        mesh.visibility = 0;
                        mesh.isPickable = false;
                    });

                    this.PhysicsPage_Active = false;
                }

                this.MaterialsPage_Active = true;
            } else {
                this.GUI_MaterialsPage.getChildMeshes().forEach((mesh) => {
                    mesh.visibility = 0;
                    mesh.isPickable = false;
                });

                materialButton_material.diffuseColor = new Color3(1, 1, 1);
                materialsButton.mesh!.scaling.z *= 2;

                this.MaterialsPage_Active = false;
            }
        });


        // Physics Button
        physicsButton.position.y = .15;
        physicsButton.scaling = new Vector3(0.5, 0.125, 1);
        physicsButton.mesh!.parent = this.GUI_NavBar_Node;

        var physicsButtonText = new TextBlock();
        physicsButtonText.text = "Physics/Vehicle";
        physicsButtonText.color = "white";
        physicsButtonText.fontSize = 14;
        physicsButtonText.scaleX = 2;
        physicsButtonText.scaleY = 4;
        physicsButton.content = physicsButtonText;

        physicsButton.onPointerDownObservable.add(() => {
            this.buttonClick1_Sound!.play();

            var physicsButton_material = <StandardMaterial>physicsButton.mesh!.material;

            if (!this.PhysicsPage_Active) {
                this.GUI_PhysicsPage.getChildMeshes().forEach((mesh) => {
                    mesh.visibility = 1;
                    mesh.isPickable = true;
                });

                physicsButton_material.diffuseColor = new Color3(.5, .5, .5);
                physicsButton.mesh!.scaling.z *= 0.5;

                if (this.MaterialsPage_Active) {
                    var materialButton_material = <StandardMaterial>materialsButton.mesh!.material;
                    materialButton_material.diffuseColor = new Color3(1, 1, 1);
                    materialsButton.mesh!.scaling.z *= 2;

                    this.GUI_MaterialsPage.getChildMeshes().forEach((mesh) => {
                        mesh.visibility = 0;
                        mesh.isPickable = false;
                    });

                    this.MaterialsPage_Active = false;
                }

                this.PhysicsPage_Active = true;
            } else {
                this.GUI_PhysicsPage.getChildMeshes().forEach((mesh) => {
                    mesh.visibility = 0;
                    mesh.isPickable = false;
                });

                physicsButton_material.diffuseColor = new Color3(1, 1, 1);
                physicsButton.mesh!.scaling.z *= 2;

                this.PhysicsPage_Active = false;
            }
        });

        // Destruction Button
        DestructionButton.scaling = new Vector3(0.5, 0.125, 1);
        DestructionButton.mesh!.parent = this.GUI_NavBar_Node;

        var DestructionButtonText = new TextBlock();
        DestructionButtonText.text = "DESTROY!!!!!";
        DestructionButtonText.color = "white";
        DestructionButtonText.fontSize = 14;
        DestructionButtonText.scaleX = 2;
        DestructionButtonText.scaleY = 4;
        DestructionButton.content = DestructionButtonText;

        DestructionButton.onPointerEnterObservable.add(() => {
            if (!this.DestructionActive) {
                var AltText = new TextBlock();
                AltText.text = "Please Navigate to the Goal Position to Activate this Button";
                AltText.color = "white";
                AltText.fontSize = 9;
                AltText.scaleY = 4;
                DestructionButton.content = AltText;
            }
        });

        DestructionButton.onPointerOutObservable.add(() => {
            if (!this.DestructionActive) {
                DestructionButton.content = DestructionButtonText;
            }
        });

        DestructionButton.onPointerDownObservable.add(() => {
            if (this.DestructionActive) {
                this.explosion_Sound!.play();
                this.Building_Node.getChildMeshes().forEach((mesh) => {
                    mesh.physicsImpostor!.setMass(this.cubeMass);
                    mesh.physicsImpostor!.wakeUp();
                    mesh.physicsImpostor!.applyForce(new Vector3(0, 5, 0), Vector3.Zero());
                });
            }
        });

        // Pages
        // Materials Page
        var MaterialsPanel = new PlanePanel();
        guiManager.addControl(MaterialsPanel);
        MaterialsPanel.blockLayout = true;
        MaterialsPanel.rows = 4;
        MaterialsPanel.margin = 0.25;
        MaterialsPanel.linkToTransformNode(this.GUI_MaterialsPage);       
        MaterialsPanel.scaling = new Vector3(0.25, 0.25, 1);

        // Create buttons for each material
        this.Materials.forEach((material) => {
            let button = new Button3D("MaterialButton");
            MaterialsPanel.addControl(button);

            button.mesh!.material = material;

            button.onPointerDownObservable.add(() => {
                this.buttonClick2_Sound!.play();
                this.Building_Node.getChildMeshes().forEach((mesh) => {
                    mesh.material = material;
                })
            });
        });

        // Physics/Vehicle Page
        var PhysicsPanel = MeshBuilder.CreatePlane("PhysicsPanel", { width: 1.5, height: 1 }, this.scene);
        PhysicsPanel.isPickable = false;
        PhysicsPanel.parent = this.GUI_PhysicsPage;

        var PhysicsPanelTexture = AdvancedDynamicTexture.CreateForMesh(PhysicsPanel, 1500, 1000);
        PhysicsPanelTexture.background = (new Color4(.5, .5, .5, .25)).toHexString();
        PhysicsPanelTexture.getChildren()[0].paddingLeftInPixels = 50;
        PhysicsPanelTexture.getChildren()[0].scaleX = 3;
        PhysicsPanelTexture.getChildren()[0].scaleY = 3;
        PhysicsPanelTexture.getChildren()[0].transformCenterX = 0;

        // Create a stack panel for the columns
        var slidePanel = new StackPanel();
        slidePanel.isVertical = true;
        slidePanel.widthInPixels = 970;
        slidePanel.heightInPixels = 225;
        slidePanel.horizontalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        PhysicsPanelTexture.addControl(slidePanel);

        // Create sliders for the building mass and vehicle speeds
        var massSlider = new Slider();
        massSlider.minimum = 0.01;
        massSlider.maximum = 200;
        massSlider.value = this.cubeMass;
        massSlider.color = "red";
        massSlider.height = "50px";
        massSlider.width = "250px";

        var vehicleSpeedSlider = new Slider();
        vehicleSpeedSlider.minimum = 1;
        vehicleSpeedSlider.maximum = 10;
        vehicleSpeedSlider.value = this.vehicleSpeed;
        vehicleSpeedSlider.color = "red";
        vehicleSpeedSlider.height = "50px";
        vehicleSpeedSlider.width = "250px";

        var vehicleTurningSpeedSlider = new Slider();
        vehicleTurningSpeedSlider.minimum = 0.01;
        vehicleTurningSpeedSlider.maximum = 3;
        vehicleTurningSpeedSlider.value = this.vehicleTurningSpeed;
        vehicleTurningSpeedSlider.color = "red";
        vehicleTurningSpeedSlider.height = "50px";
        vehicleTurningSpeedSlider.width = "250px";

        var massSliderHeader = Control.AddHeader(massSlider, "Building Block Mass", "210px", { isHorizontal: true, controlFirst: false });
        massSliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        massSliderHeader.height = "75px";
        massSliderHeader.fontSize = "14px";
        massSliderHeader.color = "White";
        slidePanel.addControl(massSliderHeader);

        var vehicleSpeedSliderHeader = Control.AddHeader(vehicleSpeedSlider, "vehicle Speed: Forward", "210px", { isHorizontal: true, controlFirst: false });
        vehicleSpeedSliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        vehicleSpeedSliderHeader.height = "75px";
        vehicleSpeedSliderHeader.fontSize = "14px";
        vehicleSpeedSliderHeader.color = "White";
        slidePanel.addControl(vehicleSpeedSliderHeader);

        var vehicleTurningSpeedSliderHeader = Control.AddHeader(vehicleTurningSpeedSlider, "Vehicle Speed: Rotational", "210px", { isHorizontal: true, controlFirst: false });
        vehicleTurningSpeedSliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        vehicleTurningSpeedSliderHeader.height = "75px";
        vehicleTurningSpeedSliderHeader.fontSize = "14px";
        vehicleTurningSpeedSliderHeader.color = "White";
        slidePanel.addControl(vehicleTurningSpeedSliderHeader);

        // Event handlers for the sliders
        massSlider.onValueChangedObservable.add((value) => {
            this.cubeMass = value;            
        });

        vehicleSpeedSlider.onValueChangedObservable.add((value) => {
            this.vehicleSpeed = value;
        });

        vehicleTurningSpeedSlider.onValueChangedObservable.add((value) => {
            this.vehicleTurningSpeed = value;
        });

        // Attach the menu to the left controller when it is connected
        this.xrHelper!.input.onControllerAddedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                this.GUI_Node.parent = this.leftController!.pointer!;
                this.GUI_Node.position = new Vector3(0, .1, .1);

                inputSource.pointer.collisionResponse = false;
            }
        });

        // Don't forget to deparent the menu or it will be destroyed!
        this.xrHelper!.input.onControllerRemovedObservable.add((inputSource) => {
            if (inputSource.uniqueId.endsWith("left")) {
                this.GUI_Node.parent = null;
            }
        });
    } 

    // Steer the vehicle
    private DriveVehicle() {
        if (this.selectedObject_right && this.selectedObject_left) {
            if (this.selectedObject_left!.name == "Handle" && this.selectedObject_right!.name == "Handle_copy") {
                this.leftController!.grip!.setParent(this.xrCamera);
                this.rightController!.grip!.setParent(this.xrCamera);

                var rightLeverDistance = this.rightController!.grip!.position.z - this.rightLeverStart!.z;
                if (rightLeverDistance > Math.PI / 4) {
                    rightLeverDistance = Math.PI / 4;
                } else if (rightLeverDistance < -Math.PI/4) {
                    rightLeverDistance = -Math.PI / 4;
                }

                var leftLeverDistance = this.leftController!.grip!.position.z - this.leftLeverStart!.z;
                if (leftLeverDistance > Math.PI / 4) {
                    leftLeverDistance = Math.PI / 4;
                } else if (leftLeverDistance < -Math.PI / 4) {
                    leftLeverDistance = -Math.PI / 4;
                }

                this.rightLeverHandle_Node.rotation.z = rightLeverDistance;           
                this.leftLeverHandle_Node.rotation.z = leftLeverDistance;

                if (rightLeverDistance > 0.15 && leftLeverDistance > 0.15) {
                    if (!this.vehicleMotion_Sound!.isPlaying) {
                        this.vehicleMode_Sound!.stop();
                        this.vehicleMotion_Sound!.play();
                    }

                    // Use delta time to calculate the proper speed
                    var moveDistance = (this.engine.getDeltaTime() / 1000) * -this.vehicleSpeed;

                    // Translate the vehicle along the forward ray in world space
                    this.Vehicle_Node.translate(this.Vehicle_Node.forward, moveDistance, Space.WORLD);
                } else if (rightLeverDistance < -0.15 && leftLeverDistance < -0.15) {
                    if (!this.vehicleMotion_Sound!.isPlaying) {
                        this.vehicleMode_Sound!.stop();
                        this.vehicleMotion_Sound!.play();
                    }

                    // Use delta time to calculate the proper speed
                    var moveDistance = (this.engine.getDeltaTime() / 1000) * this.vehicleSpeed;

                    // Translate the vehicle along the forward ray in world space
                    this.Vehicle_Node.translate(this.Vehicle_Node.forward, moveDistance, Space.WORLD);
                } else if (rightLeverDistance < -0.15 && leftLeverDistance > 0.15) {
                    if (!this.vehicleMotion_Sound!.isPlaying) {
                        this.vehicleMode_Sound!.stop();
                        this.vehicleMotion_Sound!.play();
                    }

                    // Use delta time to calculate the proper speed
                    var moveDistance = (this.engine.getDeltaTime() / 1000) * this.vehicleTurningSpeed;

                    // Translate the vehicle along the forward ray in world space
                    this.Vehicle_Node.rotate(this.Vehicle_Node.up, moveDistance, Space.WORLD);
                } else if (rightLeverDistance > 0.15 && leftLeverDistance < -0.15) {
                    if (!this.vehicleMotion_Sound!.isPlaying) {
                        this.vehicleMode_Sound!.stop();
                        this.vehicleMotion_Sound!.play();
                    }

                    // Use delta time to calculate the proper speed
                    var moveDistance = (this.engine.getDeltaTime() / 1000) * -this.vehicleTurningSpeed;

                    // Translate the vehicle along the forward ray in world space
                    this.Vehicle_Node.rotate(this.Vehicle_Node.up, moveDistance, Space.WORLD);
                } else {
                    if (this.vehicleMotion_Sound!.isPlaying) {
                        this.vehicleMotion_Sound!.stop();
                        this.vehicleMode_Sound!.play();
                    }
                }

                this.leftController!.grip!.setParent(null);
                this.rightController!.grip!.setParent(null);

                var cameraAngles = this.xrCamera!.rotationQuaternion.toEulerAngles();
                var newAngles = Quaternion.FromEulerAngles(cameraAngles.x, this.Vehicle_Node.rotation.y, cameraAngles.z);
                //this.xrCamera!.rotationQuaternion = newAngles;

                this.camera_Node.setParent(null);
                this.xrCamera!.position.x += this.camera_Node.position.x - this.xrCamera!.position.x;
                this.xrCamera!.position.z += this.camera_Node.position.z - this.xrCamera!.position.z + 6.3;
                this.camera_Node.setParent(this.Vehicle_Node);               
            }
        }
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
        this.menuEnter_Sound!.play();
        // Make the GUI visible
        this.GUI_Node.getChildMeshes().forEach((mesh) => {
            if (mesh.parent!.id != "ContainerNode" && mesh.parent!.id != "PhysicsPage") {
                mesh.visibility = 1;
                mesh.isPickable = true;
            }
        })

        // Make the left controller invisible
        this.leftController!.grip!.getChildMeshes().forEach((mesh) => {
            mesh.visibility = 0;
        });
        this.laserPointer_left!.visibility = 0;

        this.GUI_Active = true;
    }

    // Disable the menu
    private DisableMenu() {
        if (this.menuExit_Sound) {
            this.menuExit_Sound!.play();
        }
        // Make the GUI invisible
        this.GUI_Node.getChildMeshes().forEach((mesh) => {
            mesh.visibility = 0
            mesh.isPickable = false;
        })

        if (this.leftController) {
            // Make the left controller visible again
            this.leftController!.grip!.getChildMeshes().forEach((mesh) => {
                mesh.visibility = 1;
            });
            this.laserPointer_left!.visibility = 1;
        }

        // Reset buttons
        this.GUI_NavBarButtons.forEach((button) => {
            var button_material = <StandardMaterial>button.mesh!.material;
            button_material.diffuseColor = new Color3(1, 1, 1);
            button.mesh!.scaling.z = 1;
        });

        this.GUI_Active = false;
        this.MaterialsPage_Active = false;
        this.PhysicsPage_Active = false;
    }

    // Enter the vehicle
    private EnterVehicleMode() {
        this.vehicleMode_Sound!.play();     

        this.Vehicle_Meshes.forEach((mesh) => {
            mesh.visibility = 1;
        });

        this.xrCamera!.position.x = this.camera_Node.position.x;
        this.xrCamera!.position.y = this.camera_Node.position.y + this.xrCamera!.realWorldHeight;
        this.xrCamera!.position.z = this.camera_Node.position.z;

        this.Vehicle_Active = true;
    }

    // Exit the vehicle
    private ExitVehicleMode() {
        this.vehicleMode_Sound!.stop();
        this.Vehicle_Meshes.forEach((mesh) => {
            mesh.visibility = 0;
        });

        this.xrCamera!.position.y = this.xrCamera!.realWorldHeight;

        this.Vehicle_Active = false;
    }

}
/******* End of the Game class ******/   

// start the game
var game = new Game();
game.start();