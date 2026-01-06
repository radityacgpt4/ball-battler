/**
 * Battle Recorder System
 * Uses MediaRecorder API to capture canvas and audio streams
 * Exports recordings as .webm files
 */
export class BattleRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.canvas = null;
        this.audioStream = null;
    }

    /**
     * Initialize the recorder with canvas and audio streams
     * @param {HTMLCanvasElement} canvas - The game canvas
     * @param {MediaStream} audioStream - Audio stream from AudioEngine
     */
    init(canvas, audioStream) {
        this.canvas = canvas;
        this.audioStream = audioStream;
    }

    /**
     * Start recording the battle
     * @returns {boolean} Whether recording started successfully
     */
    start() {
        if (this.isRecording || !this.canvas) {
            return false;
        }

        try {
            // Get canvas stream at 30 FPS
            const canvasStream = this.canvas.captureStream(30);

            // Combine video and audio streams
            let combinedStream;
            if (this.audioStream && this.audioStream.getAudioTracks().length > 0) {
                const audioTracks = this.audioStream.getAudioTracks();
                const videoTracks = canvasStream.getVideoTracks();
                combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
            } else {
                combinedStream = canvasStream;
            }

            // Determine best codec
            const mimeType = this.getSupportedMimeType();
            if (!mimeType) {
                console.error('No supported MIME type found for MediaRecorder');
                return false;
            }

            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });

            this.recordedChunks = [];

            // Collect data chunks
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
            };

            // Handle errors
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.isRecording = false;
            };

            // Start recording with 100ms chunks
            this.mediaRecorder.start(100);
            this.isRecording = true;

            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    /**
     * Stop recording
     */
    stop() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }

    /**
     * Export the recording as a .webm file
     * @param {string} filename - Optional filename (defaults to battle_timestamp.webm)
     * @returns {Promise<Blob>} The recorded video blob
     */
    async export(filename) {
        return new Promise((resolve, reject) => {
            if (this.recordedChunks.length === 0) {
                reject(new Error('No recording data available'));
                return;
            }

            // Create blob from recorded chunks
            const mimeType = this.getSupportedMimeType();
            const blob = new Blob(this.recordedChunks, { type: mimeType });

            // Generate filename if not provided
            const finalFilename = filename || `battle_${Date.now()}.webm`;

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = finalFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Cleanup URL after download
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            resolve(blob);
        });
    }

    /**
     * Get the recorded video as a Blob without downloading
     * @returns {Blob|null} The recorded video blob or null
     */
    getBlob() {
        if (this.recordedChunks.length === 0) {
            return null;
        }
        const mimeType = this.getSupportedMimeType();
        return new Blob(this.recordedChunks, { type: mimeType });
    }

    /**
     * Clear the recorded data
     */
    clear() {
        this.recordedChunks = [];
    }

    /**
     * Get a supported MIME type for recording
     * @returns {string|null} Supported MIME type or null
     */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return null;
    }

    /**
     * Check if recording is supported in current browser
     * @returns {boolean} Whether recording is supported
     */
    static isSupported() {
        return typeof MediaRecorder !== 'undefined' &&
               typeof HTMLCanvasElement.prototype.captureStream === 'function';
    }
}
