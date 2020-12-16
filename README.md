# CSCI 5619 - Final Project

## Submission Information

### Names: Sam Schaust, Jakob Speert

### UMN Emails: schau266@umn.edu, speer034@umn.edu

### Build URL: http://www-users.cselabs.umn.edu/~speer034/CSCI5619/FinalProject/

### Third Party Assets:
#### Models:
* "Lever" - (https://clara.io/view/a5cfe553-839b-4300-8e37-983b2bc59205#)
* "Mining Dump Truck" - (https://clara.io/view/c50376fa-a0ed-4963-b190-3df0fd294f21#)

#### Sounds:
* "Backing Up Sound" - (http://soundbible.com/675-Backing-Up.html)
* "Button Sound" (ButtonClick2) - (http://soundbible.com/772-Button.html)
* "Explosion Ultra Bass Sound" - (http://soundbible.com/1807-Explosion-Ultra-Bass.html)
* "Metroid Door Sound" - (http://soundbible.com/1858-Metroid-Door.html)
* "Muscle Car Sound" - (http://soundbible.com/2209-Muscle-Car.html)
* "Tiny Button Push Sound" (ButtonClick1) - (http://soundbible.com/419-Tiny-Button-Push.html)

## How to Use
* Cross controllers in front of the camera to toggle the menu (attached to the left controller)
	- Careful: Moving the controllers outside of view of the headset will also toggle the menu
	- Building Materials
		- Displays a panel of material options for the building
		- Materials are procedurally generated; you get new options every time you reload!
		- Select a material by pointing and selecting with the right controller and its trigger to change the material of the building
	- Physics/Vehicle Settings
		- Use the sliders to toggle the variables
			- Mass of Building's Blocks: 0.01-200, default is 1
			- Speed of Vehicle (Forward): 1-10, default is 3
			- Speed of Vehicle (Rotation): 0.01-3, default is 1
	- Destroy!!!
		- Button is inactive until the user navigates to the goal-space (designated by the red plane on the ground)
		- When active, this button activates the building destruction
* Raise controllers above headset to toggle vehicle mode
* Select objects by pointing and pressing the controller trigger with either hand
	- Objects cannot be selected with the left controller when menu is activated
	- Selecting the vehicle handles can only be done with the respective controller (left controller for left handle, right controller for right handle)
	- Selected objects may be moved in the forward direction of the controller by pressing up and down on the thumbstick
	- Most objects selected with the right controller may have their position and rotation fine-tuned via bimanual interaction using the right grip
		- When the right grip is selected in this fashion, the left grip may also be held to alter the scaling of the selected object (determined by the distance between the two controllers)
* Drive the vehicle by selecting both levers
	- Forward: Push both levers forward
	- Backward: Pull both levers backward
	- Clockwise Rotations: Left forward, Right backward (there is a bug updating the camera position)
	- Counterclockwise Rotation: Left backward, Right forward (there is a bug updating the camera position)
