/**
 * Logger System
 * Handles debug logging for battle interactions
 */
export class Logger {
    constructor() {
        this.container = null;
        this.content = null;
        this.isEnabled = true;
    }

    init() {
        this.container = document.getElementById('debug-log-container');
        this.content = document.getElementById('debug-log-content');
        this.toggleBtn = document.getElementById('debug-toggle');
        
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.content.classList.toggle('collapsed');
                this.toggleBtn.textContent = this.content.classList.contains('collapsed') 
                    ? 'Show Debug Log' 
                    : 'Hide Debug Log';
            });
        }
        
        this.log("Logger initialized. Battle interactions will appear here.");
    }

    log(message, type = 'info') {
        if (!this.content || !this.isEnabled) return;

        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + "." + String(Date.now() % 1000).padStart(3, '0');
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        
        this.content.appendChild(entry);
        
        // Auto-scroll to bottom
        this.content.scrollTop = this.content.scrollHeight;
        
        // Limit log size to prevent memory issues
        if (this.content.children.length > 200) {
            this.content.removeChild(this.content.firstChild);
        }
    }

    clear() {
        if (this.content) this.content.innerHTML = '';
    }
}

export const logger = new Logger();