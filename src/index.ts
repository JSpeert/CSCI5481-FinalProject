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

class Game 
{ 
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    private xrCamera: WebXRCamera | null; 
    private leftController: WebXRInputSource | null;
    private rightController: WebXRInputSource | null;

    private selectedObject: AbstractMesh | null;
    private selectionTransform: TransformNode | null;

    private laserPointer: LinesMesh | null;
    private bimanualLine: LinesMesh | null;
    private miniatureObject: InstancedMesh | null;

    private previousLeftControllerPosition: Vector3;
    private previousRightControllerPosition: Vector3;

    private Building_Node: TransformNode;
    private Vehicle_Node: TransformNode;
    private leftLever_Node: TransformNode;
    private rightLever_Node: TransformNode;
    private GUI_Node: TransformNode;

    // Values to be toggled
    private GUI_Active: Boolean;
    private Vehicle_Active: Boolean;
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
        this.leftController = null;
        this.rightController = null;
    
        this.selectedObject = null;
        this.selectionTransform = null;
        
        this.laserPointer = null;
        this.bimanualLine = null;
        this.miniatureObject = null;

        this.previousLeftControllerPosition = Vector3.Zero();
        this.previousRightControllerPosition = Vector3.Zero();

        this.Building_Node = new TransformNode("Building", this.scene);
        this.Vehicle_Node = new TransformNode("Vehicle", this.scene);
        this.leftLever_Node = new TransformNode("LeftLever", this.scene);
        this.rightLever_Node = new TransformNode("RightLever", this.scene);    
        this.GUI_Node = new TransformNode("GUI", this.scene);

        this.GUI_Active = false;
        this.Vehicle_Active = false;
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

        // Creates the XR experience helper
        const xrHelper = await this.scene.createDefaultXRExperienceAsync({});

        // Assigns the web XR camera to a member variable
        this.xrCamera = xrHelper.baseExperience.camera;

        // Remove default teleportation and pointer selection
        xrHelper.teleportation.dispose();
        xrHelper.pointerSelection.dispose();

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

        // Attach the laser pointer to the right controller when it is connected
        xrHelper.input.onControllerAddedObservable.add((inputSource) => {
            if(inputSource.uniqueId.endsWith("right"))
            {
                this.rightController = inputSource;
                this.laserPointer!.parent = this.rightController.pointer;
                this.laserPointer!.visibility = 1;
            }
            else 
            {
                this.leftController = inputSource;
            }  
        });

        // Don't forget to deparent the laser pointer or it will be destroyed!
        xrHelper.input.onControllerRemovedObservable.add((inputSource) => {

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
        this.Building_Node.scaling.y = 5;

        // Load External Assets (Meshes and Sounds)
        this.loadExternalAssets();

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

        // Update the user position

        // Check for collision with building

        // Update objects in the WIM

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
                }

                // If an object was hit, select it
                if(pickInfo?.hit)
                {
                    this.selectedObject = pickInfo!.pickedMesh;
                    this.selectedObject!.enableEdgesRendering();

                    // Parent the object to the transform on the laser pointer
                    this.selectionTransform!.position = new Vector3(0, 0, pickInfo.distance);
                    this.selectedObject!.setParent(this.selectionTransform!);
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
        if(component?.changes.axes && this.selectedObject && this.selectedObject.parent)
        {
            // Use delta time to calculate the proper speed
            var moveDistance = -component.axes.y * (this.engine.getDeltaTime() / 1000) * 3;

            // Translate the object along the depth ray in world space
            this.selectedObject.translate(this.laserPointer!.forward, moveDistance, Space.WORLD);
        }
    }

    private onRightSqueeze(component?: WebXRControllerComponent)
    {
        if(this.selectedObject && this.leftController)
        {
            if(component?.changes.pressed)
            {
                // Button down
                if(component?.pressed)
                {
                    this.bimanualLine!.visibility = 1;
                    this.miniatureObject = new InstancedMesh('miniatureObject', <Mesh>this.selectedObject);
                }
                // Button release
                else
                {
                    this.bimanualLine!.visibility = 0;
                    this.miniatureObject?.dispose();
                }
            }

            if(component?.pressed)
            {
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

    private onLeftSqueeze(component?: WebXRControllerComponent)
    {
        // Only add scale manipulation if the right squeeze button is already being pressed
        if(component?.pressed && this.selectedObject &&
            this.rightController?.motionController?.getComponent("xr-standard-squeeze").pressed)
        {
            // Scale manipulation
            var bimanualVector = this.rightController!.grip!.position.subtract(this.leftController!.grip!.position);
            var previousBimanualVector = this.previousRightControllerPosition.subtract(this.previousLeftControllerPosition);
            var scaleFactor = bimanualVector.length() / previousBimanualVector.length();
            this.selectedObject.scaling = this.selectedObject.scaling.scale(scaleFactor);
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
            });
        }

        var lever_Task = assetsManager.addMeshTask("leverMesh", "", "assets/models/", "lever.babylon");
        lever_Task.onSuccess = ((task) => {
            lever_Task.loadedMeshes.forEach((mesh) => {
                mesh.parent = this.leftLever_Node;
                mesh.material = this.Materials[1];
                if (mesh.id != "Handle") {
                    mesh.isPickable = false;
                }
                var copyMesh = new InstancedMesh(mesh.name + "_copy", <Mesh>mesh);
                copyMesh.parent = this.rightLever_Node;
            });
        });

        // This loads all the assets and displays a loading screen
        assetsManager.load();

        // Build the vehicle
        this.leftLever_Node.position = new Vector3(-0.64, 5.29, 7.12);
        this.leftLever_Node.rotation = new Vector3(0, Math.PI / 2, 0);
        this.leftLever_Node.scaling = new Vector3(0.01, 0.01, 0.01);

        this.rightLever_Node.position = new Vector3(0.64, 5.29, 7.12);
        this.rightLever_Node.rotation = new Vector3(0, Math.PI / 2, 0);
        this.rightLever_Node.scaling = new Vector3(0.01, 0.01, 0.01);

        this.Vehicle_Node.position = new Vector3(0, -1.2, 0);
        this.Vehicle_Node.rotation = new Vector3(0, Math.PI, 0);
        this.Vehicle_Node.scaling = new Vector3(0.05, 0.05, 0.05);

        this.leftLever_Node.setParent(this.Vehicle_Node);
        this.rightLever_Node.setParent(this.Vehicle_Node);

        (<Mesh>this.Vehicle_Node).visibility = 0;
    }

    /*private CreateGUI() {
        // The manager automates some of the GUI creation steps
        var guiManager = new GUI3DManager(this.scene);

        // Create a parent transform for the object configuration panel
        var configTransform = new TransformNode("textTransform");

        // Create a plane for the object configuration panel
        var configPlane = MeshBuilder.CreatePlane("configPlane", { width: 1.5, height: .5 }, this.scene);
        configPlane.position = new Vector3(0, 2, 1);
        configPlane.parent = configTransform;

        // Create a dynamic texture the object configuration panel
        var configTexture = AdvancedDynamicTexture.CreateForMesh(configPlane, 1500, 500);
        configTexture.background = (new Color4(.5, .5, .5, .25)).toHexString();

        // Create a stack panel for the columns
        var columnPanel = new StackPanel();
        columnPanel.isVertical = false;
        columnPanel.widthInPixels = 1400;
        columnPanel.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        columnPanel.paddingLeftInPixels = 50;
        columnPanel.paddingTopInPixels = 50;
        configTexture.addControl(columnPanel);

        // Create a stack panel for the radio buttons
        var radioButtonPanel = new StackPanel();
        radioButtonPanel.widthInPixels = 400;
        radioButtonPanel.isVertical = true;
        radioButtonPanel.verticalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        columnPanel.addControl(radioButtonPanel);

        // Create radio buttons for changing the object type
        var radioButton1 = new RadioButton("radioButton1");
        radioButton1.width = "50px";
        radioButton1.height = "50px";
        radioButton1.color = "lightblue";
        radioButton1.background = "black";

        var radioButton2 = new RadioButton("radioButton1");
        radioButton2.width = "50px";
        radioButton2.height = "50px";
        radioButton2.color = "lightblue";
        radioButton2.background = "black";

        // Text headers for the radio buttons
        var radioButton1Header = Control.AddHeader(radioButton1, "box", "500px", { isHorizontal: true, controlFirst: true });
        radioButton1Header.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        radioButton1Header.height = "75px";
        radioButton1Header.fontSize = "48px";
        radioButton1Header.color = "white";
        radioButtonPanel.addControl(radioButton1Header);

        var radioButton2Header = Control.AddHeader(radioButton2, "sphere", "500px", { isHorizontal: true, controlFirst: true });
        radioButton2Header.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        radioButton2Header.height = "75px";
        radioButton2Header.fontSize = "48px";
        radioButton2Header.color = "white";
        radioButtonPanel.addControl(radioButton2Header);

        // Create a transform node to hold the configurable mesh
        var configurableMeshTransform = new TransformNode("configurableMeshTransform", this.scene);
        configurableMeshTransform.position = new Vector3(0, 1, 4);

        // Event handlers for the radio buttons
        radioButton1.onIsCheckedChangedObservable.add((state) => {
            if (state) {
                if (this.configurableMesh) {
                    this.configurableMesh.dispose();
                }
                this.configurableMesh = MeshBuilder.CreateBox("configurableMesh", { size: 1 }, this.scene);
                this.configurableMesh.parent = configurableMeshTransform;

            }
        });

        radioButton2.onIsCheckedChangedObservable.add((state) => {
            if (state) {
                if (this.configurableMesh) {
                    this.configurableMesh.dispose();
                }
                this.configurableMesh = MeshBuilder.CreateSphere("configurableMesh", { diameter: 1 }, this.scene);
                this.configurableMesh.parent = configurableMeshTransform;
            }
        });

        // Create a stack panel for the radio buttons
        var sliderPanel = new StackPanel();
        sliderPanel.widthInPixels = 500;
        sliderPanel.isVertical = true;
        sliderPanel.verticalAlignment = StackPanel.VERTICAL_ALIGNMENT_TOP;
        columnPanel.addControl(sliderPanel);

        // Create sliders for the x, y, and z rotation
        var xSlider = new Slider();
        xSlider.minimum = 0;
        xSlider.maximum = 360;
        xSlider.value = 0;
        xSlider.color = "lightblue";
        xSlider.height = "50px";
        xSlider.width = "500px";

        var ySlider = new Slider();
        ySlider.minimum = 0;
        ySlider.maximum = 360;
        ySlider.value = 0;
        ySlider.color = "lightblue";
        ySlider.height = "50px";
        ySlider.width = "500px";

        var zSlider = new Slider();
        zSlider.minimum = 0;
        zSlider.maximum = 360;
        zSlider.value = 0;
        zSlider.color = "lightblue";
        zSlider.height = "50px";
        zSlider.width = "500px";

        // Create text headers for the sliders
        var xSliderHeader = Control.AddHeader(xSlider, "x", "50px", { isHorizontal: true, controlFirst: false });
        xSliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        xSliderHeader.height = "75px";
        xSliderHeader.fontSize = "48px";
        xSliderHeader.color = "white";
        sliderPanel.addControl(xSliderHeader);

        var ySliderHeader = Control.AddHeader(ySlider, "y", "50px", { isHorizontal: true, controlFirst: false });
        ySliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        ySliderHeader.height = "75px";
        ySliderHeader.fontSize = "48px";
        ySliderHeader.color = "white";
        sliderPanel.addControl(ySliderHeader);

        var zSliderHeader = Control.AddHeader(zSlider, "z", "50px", { isHorizontal: true, controlFirst: false });
        zSliderHeader.horizontalAlignment = StackPanel.HORIZONTAL_ALIGNMENT_LEFT;
        zSliderHeader.height = "75px";
        zSliderHeader.fontSize = "48px";
        zSliderHeader.color = "white";
        sliderPanel.addControl(zSliderHeader);

        // Event handlers for the sliders
        xSlider.onValueChangedObservable.add((value) => {
            configurableMeshTransform.rotation.x = value * Math.PI / 180;
        });

        ySlider.onValueChangedObservable.add((value) => {
            configurableMeshTransform.rotation.y = value * Math.PI / 180;
        });

        zSlider.onValueChangedObservable.add((value) => {
            configurableMeshTransform.rotation.z = value * Math.PI / 180;
        });
    } */
}
/******* End of the Game class ******/   

// start the game
var game = new Game();
game.start();