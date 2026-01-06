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
        this.copyBtn = document.getElementById('debug-copy');
        
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => {
                this.content.classList.toggle('collapsed');
                this.toggleBtn.textContent = this.content.classList.contains('collapsed')
                    ? 'Show Debug Log'
                    : 'Hide Debug Log';
            });
        }

        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => {
                if (!this.content) return;
                const text = this.content.innerText;
                
                // Try Clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        this.showCopyFeedback();
                    }).catch(err => {
                        console.warn('Clipboard API failed, trying fallback', err);
                        this.fallbackCopyText(text);
                    });
                } else {
                    this.fallbackCopyText(text);
                }
            });
        }
        
        this.log("Logger initialized. Battle interactions will appear here.");
    }

    fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure it's not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showCopyFeedback();
            } else {
                this.log('System: Copy failed (browser not supported)', 'error');
            }
        } catch (err) {
            console.error('Fallback copy failed', err);
            this.log('System: Copy failed', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    showCopyFeedback() {
        if (!this.copyBtn) return;
        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = 'Copied!';
        this.copyBtn.style.borderColor = '#4ecdc4';
        this.copyBtn.style.color = '#4ecdc4';
        
        setTimeout(() => {
            this.copyBtn.textContent = originalText;
            this.copyBtn.style.borderColor = '';
            this.copyBtn.style.color = '';
        }, 2000);
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