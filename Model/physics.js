//This module takes care of punching response based on conservation of momentum and frictional decceleration; note that parts of the punch back mechanics is implemented in scene.js.
//Note that since each NPC is given a random initial velocity vi upon creation, when getting punched, it's new velocity will be v2 = vi + dv at that instant, where dv is calculated using conservation of momentum.
//Then, the character will be subject to decceleration by a kinetic frictional force while sliding;
//and the decceleration stops when the initial gain in velocity (delta v) becomes 0, at which point the NPC's start to move at constant speeds again.
//And we will use verlet/forward-euler/symplectic integration to simulate this decceleration movement process.
//Moreover, note that the moving direction of NPC's does not change before/after the punch; while sliding (after being punched), it simply ignores its original moving direction and instead starts to move entirely according to the new velocity vector v2 that is in alignment with the direction of force; and after the sliding ends, it resumes to move in its original moving direction before punch.
//Also note that we assume the initial velocity vi is a constant velocity that is never affected by friction; a physical explanation for this mechanism (don't have to read unless you're picky): At spawn, each NPC uses their legs to produce an acceleration that's greater than kinetic frictional force to give themselves an initial velocity, and then just use their legs to keeps producing an acceleration exactly equal to kinetic frictional force at any instant in normal walking mode to keep their speeds constant. However, in the process of getting punched, they are actually sliding & can't walk, so before the sliding stops, they are now subject to full decceleration by kinetic frictional force. And the sliding stops when delta v becomes 0 (they lose all increased speed from the punch), at which instant they are able to walk again, so they can keep maintaining their initial constant velocity by constantly cancelling out the kinetic frictional force with their leg force.

//Detailed implementation:
//When a collision is detected, and one of the sources is main character's left or right hand, and the destination is an NPC,
//and when the corresponding keyboard input is also detected at this frame, the punch back condition is satisfied.
//The punch back condition will cause the velocity vector of the collided NPC to INCREASE in the direction of force;
//this delta-v is calculated using conservation of momentum: m1v1 + m2v2 = m1v3 + m2v4.
//m1 and m2 are predefined quantities; they are main character's arm mass & NPC's body mass.
//v1 is a randomly-generated value in some range; it's the main character's punch velocity. (this means each time the main character might produce punches with different strengths)
//v2 is NPC character's speed along direction of force; it is calculated by finding the projectino of NPC's velocity vector along direction of force. Speed & direction of NPC's are defined in NPC class.
//v3 is end velocity for main character's arm, which is 0;
//Hence we calculate v4, which is the total increase in velocity of the NPC, in the direction of force, at end of punch.
//The direction of force is assumed to be direction of vector that connects positions of main character & collided NPC (their torso positions);
//Moreover, we also have some predefined & fixed coefficient of friction (mu); we use a = mu * (mg) / m = mu * g as the constant kinetic frictional-acceleration experienced by the collided NPC with increased velocity.
//Finally, We provide all three methods (forward euler / symplectic / verlet) to simulate the punch back process. Here we use verlet.

//current position, current velocity, current acceleration, current total external force (0 normally, constant kinetic frictional force if sliding), mass, dt

//physical constants:
export const player_mass = 2.0;
export const npc_mass = 1.0;
//gravity
export const gravity = 9.8;
//kinetic friction coefficient
export const mu = 0.01;


export function euler(cp, cv, ca, dt) {
        const na = ca;    // Newton's Second Law
        const nv = cv + na * dt;    // Update velocity using new acceleration
        const np = cp + cv * dt;    // Update position using old velocity
        return [np, nv, na];
}

export function symplectic(cp, cv, ca, dt) {
        const na = ca;
        const nv = cv + (na * (dt));
        const np = cp + (nv * (dt));
        return [np, nv, na];
}

//current pos, previous pos, current velocity, current acceleration, delta time
//integrate separately for both x and z axis
export function verlet(cp, pp, cv, ca, dt) {
        //na is new acceleration, etc.
        const na = ca; // Newton's Second Law
        // Compute new position using Verlet integration
        let np = 2 * cp - pp + na * (dt * dt);
        // Estimate velocity (central difference formula)
        let nv = (np - pp) / (2 * dt);
        return [np, nv, na];
}

//calculate projection of initial speed along the normalized force/acceleration direction vector
//note that this projected velocity vector can have negative components, which makes sense
export function proj(moveSpeed, moveDir, forceDir) {
        let vx = 0, vz = 0;
        //for normalized vector B, proj_B(A) = (A dot B) B.
        vx = (forceDir.x * moveDir.x * moveSpeed + forceDir.z * moveDir.z * moveSpeed) * forceDir.x;
        vz = (forceDir.x * moveDir.x * moveSpeed + forceDir.z * moveDir.z * moveSpeed) * forceDir.z;
        //return magnitude/norm of the velocity. note that since all velocity on y component is 0, it is not accounted
        return Math.sqrt(vx*vx + vz*vz);
}

export function calcSlideSpeed(v1, v2, v3 = 0) {
        //calculated using conservation of momentum, assuming closed system (not external force)
        let m1 = player_mass;
        let m2 = npc_mass;
        let v4 = ((m1*v1 + m2*v2) - m1*0) / m2;
        return v4;
}