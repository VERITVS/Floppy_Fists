// Modified game.js - With win condition logic intact
import * as T from 'three';

export class Game {
    constructor(scene) {
        this.scene = scene;
        this.level = 1;
        this.npcsToDefeat = 0;
        this.defeatedCount = 0;
        this.punchedNpcs = new Map(); // Track NPCs hit once
        this.defeatedNpcs = new Set(); // Track NPCs that are defeated
        this.totalTimeRemaining = 240; // 4 minutes to beat all levels
        this.gameActive = false;
        this.levelComplete = false;
        this.gameOver = false; 
        
        // Level requirements
        this.levelRequirements = {
            1: { npcsToDefeat: 1, speed: 1.0 },
            2: { npcsToDefeat: 3, speed: 2.0 },
            3: { npcsToDefeat: 5, speed: 5.0 },
            4: { npcsToDefeat: 10, speed: 10.0 },
            5: { npcsToDefeat: 10, speed: 20.0 }
        };
        
        // Create message box for game messages
        this.messageBox = document.createElement('div');
        this.messageBox.style.position = 'absolute';
        this.messageBox.style.top = '50%';
        this.messageBox.style.left = '50%';
        this.messageBox.style.transform = 'translate(-50%, -50%)';
        this.messageBox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.messageBox.style.color = '#ffffff';
        this.messageBox.style.padding = '20px';
        this.messageBox.style.borderRadius = '10px';
        this.messageBox.style.fontSize = '28px';
        this.messageBox.style.fontFamily = 'Arial, sans-serif';
        this.messageBox.style.textAlign = 'center';
        this.messageBox.style.display = 'none';
        this.messageBox.style.zIndex = '1000';
        this.messageBox.style.width = '500px';
        document.body.appendChild(this.messageBox);
        
        // Show start message
        this.showStartMessage();
        
        // Start the timer for the entire game
        this.startTimer();
        
        // Hook into the scene's collision system to intercept NPC sliding state changes
        this.hookIntoSceneRender();
    }
    
    hookIntoSceneRender() {
        // Keep a reference to the original render method
        const originalRender = this.scene.render;
        
        // Replace the render method to integrate our game loop
        this.scene.render = (dt) => {
            // Call the original render
            originalRender.call(this.scene, dt);
            
            // Process the game update AFTER original render
            this.gameUpdateLoop(dt);
        };
    }
    
    gameUpdateLoop(dt) {
        // Process NPC collisions
        this.checkSlidingNPCs();
        
        // Exit if game is not active
        if (!this.gameActive) return;
        
        // Clean up defeated NPCs
        this.cleanupDefeatedNPCs();
        
        // Check win condition - CRITICAL
        if (this.defeatedCount >= this.npcsToDefeat && !this.levelComplete) {
            this.completeLevel();
        }
    }
    
    checkSlidingNPCs() {
        // Check if any NPCs were just set to sliding state by the physics engine
        for (const npc of this.scene.npcs) {
            // If this NPC started sliding and hasn't been tracked yet
            if (npc.isSliding === true && !npc.punchProcessed) {
                // Mark this punch as processed so we don't count it multiple times
                npc.punchProcessed = true;
                
                // Check if this NPC has already been hit once
                if (this.punchedNpcs.has(npc)) {
                    // This is the second hit, defeat the NPC
                    this.defeatedNpcs.add(npc);
                    npc.defeated = true;
                    this.defeatedCount++;
                    
                    console.log(`NPC defeated! Count: ${this.defeatedCount}/${this.npcsToDefeat}`);
                } else {
                    // First hit, mark the NPC red
                    this.punchedNpcs.set(npc, true);
                    
                    // Change color to red
                    for (const mesh of npc.mesh) {
                        if (mesh && mesh.material) {
                            mesh.material.color.set(0xff0000); // Red
                        }
                    }
                    
                    console.log(`NPC first hit - marked red`);
                }
            }
            
            // Reset the processed flag when sliding stops
            if (!npc.isSliding && npc.punchProcessed) {
                npc.punchProcessed = false;
            }
        }
    }
    
    showMessage(message, duration = 3000, callback = null) {
        this.messageBox.innerHTML = message;
        this.messageBox.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                this.messageBox.style.display = 'none';
                if (callback) callback();
            }, duration);
        }
    }
    
    showStartMessage() {
        const startMessage = `
            <h2>FLOPPY FISTS</h2>
            <p>Welcome to the Ragdoll Arena!</p>
            <p>Defeat enemies by punching them twice.</p>
            <p>You have 4 minutes to complete all 5 levels!</p>
            <p>Click anywhere to start Level 1</p>
        `;
        
        this.showMessage(startMessage, 0);
        
        const startGame = () => {
            this.messageBox.style.display = 'none';
            document.removeEventListener('click', startGame);
            this.startLevel(1);
        };
        
        document.addEventListener('click', startGame);
    }
    
    showLevelCompleteMessage() {
        console.log(`Level ${this.level} complete! Showing completion message`);
        
        const nextLevel = this.level + 1;
        
        if (nextLevel <= 5) {
            const message = `
                <h2>Level ${this.level} Complete!</h2>
                <p>Great job! You defeated all the required NPCs.</p>
                <p>Get ready for Level ${nextLevel}!</p>
                <p>You need to defeat ${this.levelRequirements[nextLevel].npcsToDefeat} NPCs.</p>
                <p>Click anywhere to continue</p>
            `;
            
            this.showMessage(message, 0);
            
            const startNextLevel = () => {
                this.messageBox.style.display = 'none';
                document.removeEventListener('click', startNextLevel);
                this.startLevel(nextLevel);
            };
            
            document.addEventListener('click', startNextLevel);
        } else {
            this.showGameCompleteMessage();
        }
    }
    
    showGameCompleteMessage() {
        const message = `
            <h2>Congratulations!</h2>
            <p>You've completed all levels!</p>
            <p>You are the Floppy Fists Champion!</p>
            <p>Click anywhere to restart</p>
        `;
        
        this.showMessage(message, 0);
        
        const restartGame = () => {
            this.messageBox.style.display = 'none';
            document.removeEventListener('click', restartGame);
            this.restartGame();
        };
        
        document.addEventListener('click', restartGame);
    }
    
    showGameOverMessage() {
        const message = `
            <h2>Game Over!</h2>
            <p>You ran out of time.</p>
            <p>Click anywhere to restart</p>
        `;
        
        this.showMessage(message, 0);
        
        const restartGame = () => {
            this.messageBox.style.display = 'none';
            document.removeEventListener('click', restartGame);
            this.restartGame();
        };
        
        document.addEventListener('click', restartGame);
    }
    
    restartGame() {
        // Reset game state
        this.level = 1;
        this.defeatedCount = 0;
        this.totalTimeRemaining = 240;
        this.punchedNpcs.clear();
        this.defeatedNpcs.clear();
        
        // Start level 1
        this.startLevel(1);
        
        // Reset the timer
        clearInterval(this.timerInterval);
        this.startTimer();
    }
    
    startLevel(level) {
        console.log(`Starting level ${level}`);
        
        this.level = level;
        this.npcsToDefeat = this.levelRequirements[level].npcsToDefeat;
        this.defeatedCount = 0;
        this.punchedNpcs.clear();
        this.defeatedNpcs.clear();
        this.gameActive = true;
        this.levelComplete = false;
        this.gameOver = false;
        
        // Determine number of NPCs for this level
        let totalNpcs;
        if (level <= 3) {
            totalNpcs = this.npcsToDefeat * 2;
        } else {
            totalNpcs = 15; // Cap at 15 for levels 4 and 5
        }
        
        // Reset and recreate NPCs
        this.resetNPCs(totalNpcs);
        
        // Show level start message
        this.showMessage(`Level ${level} - Defeat ${this.npcsToDefeat} NPCs!`, 3000);
        
        console.log(`Level ${level} initialized with ${totalNpcs} NPCs, ${this.npcsToDefeat} to defeat`);
    }
    
    resetNPCs(totalNpcs) {
        console.log(`Resetting NPCs, creating ${totalNpcs} new ones`);
        
        // Clear existing NPCs
        while (this.scene.npcs.length > 0) {
            const npc = this.scene.npcs.pop();
            for (const mesh of npc.mesh) {
                if (mesh) {
                    this.scene.scene.remove(mesh);
                }
            }
        }
        
        // Create new NPCs for this level
        this.scene.createNPCs(totalNpcs);
        
        // Apply speed multiplier for this level and ensure each NPC has a unique ID
        const speedMultiplier = this.levelRequirements[this.level].speed;
        for (const npc of this.scene.npcs) {
            npc.moveSpeed *= speedMultiplier;
            npc.animSpeed *= speedMultiplier;
            
            // Give each NPC a unique ID to track them consistently
            npc.uniqueId = `npc-${Math.random().toString(36).substr(2, 9)}`;
            
            // Initialize state flags
            npc.defeated = false;
            npc.punchProcessed = false;
        }
        
        // Rebuild collision system with new NPCs
        if (this.scene.collisionSystem) {
            this.scene.collisionSystem.clear();
            this.scene.collisionSystem.addCharacter(this.scene.mainCharacter, 'main');
            for (const npc of this.scene.npcs) {
                this.scene.collisionSystem.addCharacter(npc, 'npc');
            }
            this.scene.collisionSystem.buildBVH();
        }
    }
    
    startTimer() {
        // Start countdown timer for the entire game
        this.timerInterval = setInterval(() => {
            if (this.gameActive && !this.gameOver) {
                this.totalTimeRemaining--;
                
                if (this.totalTimeRemaining <= 0) {
                    this.endGame(false);
                }
            }
        }, 1000);
    }
    
    completeLevel() {
        console.log(`Level ${this.level} completed!`);
        
        this.levelComplete = true;
        this.gameActive = false;
        
        setTimeout(() => {
            this.showLevelCompleteMessage();
        }, 1000);
    }
    
    endGame(victory) {
        console.log(`Game over, victory: ${victory}`);
        
        this.gameActive = false;
        this.gameOver = true;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (victory) {
            this.showGameCompleteMessage();
        } else {
            this.showGameOverMessage();
        }
    }
    
    cleanupDefeatedNPCs() {
        // Count how many NPCs will be cleaned up
        let cleanupCount = 0;
        
        // Remove defeated NPCs from the scene
        for (let i = this.scene.npcs.length - 1; i >= 0; i--) {
            const npc = this.scene.npcs[i];
            
            if (!npc) continue; // Skip invalid NPCs
            
            // Check if this NPC has been marked as defeated
            if (npc.defeated === true || this.defeatedNpcs.has(npc)) {
                cleanupCount++;
                
                // Make sure we properly mark it as defeated in both places
                npc.defeated = true;
                this.defeatedNpcs.add(npc);
                
                // Make invisible
                for (const mesh of npc.mesh) {
                    if (mesh) {
                        mesh.visible = false;
                    }
                }
                
                // Remove from active NPCs array but keep in collision system
                this.scene.npcs.splice(i, 1);
            }
        }
        
        if (cleanupCount > 0) {
            console.log(`Cleaned up ${cleanupCount} defeated NPCs, ${this.scene.npcs.length} remaining`);
        }
    }
}