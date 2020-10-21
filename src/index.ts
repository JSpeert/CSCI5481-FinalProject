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
import { Logger } from "@babylonjs/core/Misc/logger";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import {MeshBuilder} from  "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

// Side effects
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/inspector";

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
            skyboxColor: new Color3(0, 0, 0)
        });

        // Make sure the environment and skybox is not pickable!
        environment!.ground!.isPickable = false;
        environment!.skybox!.isPickable = false;

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

        // Create a blue emissive material
        var cubeMaterial = new StandardMaterial("blueMaterial", this.scene);
        cubeMaterial.diffuseColor = new Color3(.284, .73, .831);
        cubeMaterial.specularColor = Color3.Black();
        cubeMaterial.emissiveColor = new Color3(.284, .73, .831);

        // Create a test cube at a convenient place
        var testCube = MeshBuilder.CreateBox("testCube", {size: .25}, this.scene);
        testCube.position = new Vector3(.5, 1.5, 2);
        testCube.material = cubeMaterial;
        testCube.edgesWidth = .3;

        // Create a 3D selection and manipulation testbed
        for (let i=0; i < 100; i++)
        {
            let cube = MeshBuilder.CreateBox("cube", {size: Math.random() * .3 + .1}, this.scene);
            cube.position = new Vector3(Math.random() * 15 - 7.5, Math.random() * 5 + .2, Math.random() * 15 - 7.5);
            cube.material = cubeMaterial;
            cube.edgesWidth = .3;
        }
        
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

}
/******* End of the Game class ******/   

// start the game
var game = new Game();
game.start();