// The beast skeleton, shared by the server physics and the client mesh.
// 14 particles. Rest pose: standing, facing +Z, Y up, arms out in an A-pose (the character's left is +X).

export const P = {
  HEAD: 0, CHEST: 1, PELVIS: 2, SHL: 3, SHR: 4, BELLY: 5,
  ELL: 6, ELR: 7, HAL: 8, HAR: 9, KNL: 10, KNR: 11, FTL: 12, FTR: 13
};
export const NP = 14;

export const REST = [
  [0.00, 1.42, 0.02],   // head
  [0.00, 1.08, 0.00],   // chest
  [0.00, 0.60, 0.00],   // pelvis
  [0.25, 1.14, 0.00],   // shoulder L
  [-0.25, 1.14, 0.00],  // shoulder R
  [0.00, 0.82, 0.19],   // belly (gives the torso a front)
  [0.47, 0.96, 0.00],   // elbow L
  [-0.47, 0.96, 0.00],  // elbow R
  [0.62, 0.72, 0.04],   // hand L
  [-0.62, 0.72, 0.04],  // hand R
  [0.16, 0.31, 0.03],   // knee L
  [-0.16, 0.31, 0.03],  // knee R
  [0.17, 0.11, 0.00],   // foot L
  [-0.17, 0.11, 0.00]   // foot R
];

// collision radius and mass of every particle
export const RADIUS = [0.26, 0.25, 0.27, 0.15, 0.15, 0.20, 0.12, 0.12, 0.12, 0.12, 0.14, 0.14, 0.11, 0.11];
export const MASS = [2.0, 3.5, 3.5, 1.0, 1.0, 1.5, 0.6, 0.6, 0.5, 0.5, 0.9, 0.9, 0.9, 0.9];

// the rigid-ish core of the body
export const TORSO = [P.HEAD, P.CHEST, P.PELVIS, P.SHL, P.SHR, P.BELLY];

// height of the pelvis above the centre of a planted foot when standing
export const STAND_H = 0.49;

// A relaxed standing pose (arms hanging) used for spawning and for menu / lobby characters.
export const IDLE = REST.map(p => p.slice());
IDLE[P.ELL] = [0.36, 0.87, 0.02]; IDLE[P.ELR] = [-0.36, 0.87, 0.02];
IDLE[P.HAL] = [0.40, 0.59, 0.07]; IDLE[P.HAR] = [-0.40, 0.59, 0.07];

// Bones used for skinning: each is driven by particles.
export const BONE = { PELVIS: 0, CHEST: 1, HEAD: 2, UARM_L: 3, UARM_R: 4, FARM_L: 5, FARM_R: 6, THIGH_L: 7, THIGH_R: 8, SHIN_L: 9, SHIN_R: 10, FOOT_L: 11, FOOT_R: 12 };
export const NB = 13;
// where the thigh bone starts, relative to the pelvis particle (in the torso frame)
export const HIP_OFF = [0.12, -0.04, 0.0];
