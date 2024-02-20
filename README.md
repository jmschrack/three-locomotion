# three-locomotion

This is nowhere near done yet.  This is just a conglomeration of tools I started making to work with Mixamo models and animations in ThreeJS.

- Just make it work (dead code, hardcoded, )  **<- You are currently here**
- Refactor (make it extensible and re-usable)
- Clean it up (bring the code up to standards, publish libraries)

In large part, this is a port of https://github.com/runevision/LocomotionSystem  to ThreeJS.

## The goal:

- upload multiple GLTF files with animations
- export a single GLTF file with all animations embedded
- analyze moving animation's  walk cycle to determine native speed (and locomotion data)
- Make a standalone library of Runevision's Locomotion system for use with ThreeJS