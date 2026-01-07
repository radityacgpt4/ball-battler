/**
 * Physics System
 * Contains all math and physics calculations
 * IMPORTANT: Do not modify these calculations - they define the game feel
 */
export class Physics {
    static dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

    static lineCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx*dx + dy*dy;
        if (lenSq === 0) return Physics.dist(x1, y1, cx, cy) <= r;
        const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        return Physics.dist(cx, cy, closestX, closestY) <= r;
    }

    // Returns first intersection point of ray with circle
    static rayCircleIntersect(rayX, rayY, dirX, dirY, cx, cy, r) {
        const fx = rayX - cx;
        const fy = rayY - cy;

        const a = dirX * dirX + dirY * dirY;
        const b = 2 * (fx * dirX + fy * dirY);
        const c = (fx * fx + fy * fy) - r * r;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return null;

        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        // Get first positive intersection (in ray direction)
        let t = t1 > 0.01 ? t1 : (t2 > 0.01 ? t2 : -1);
        if (t < 0) return null;

        return {
            x: rayX + t * dirX,
            y: rayY + t * dirY,
            t: t,
            dist: t * Math.sqrt(a)
        };
    }

    static rayBoxIntersect(px, py, dx, dy, bx, by, bw, bh) {
        let minT = Infinity;
        let hit = null;
        if (dx !== 0) {
            let t1 = (bx - px) / dx;
            if (t1 > 0.01 && t1 < minT) {
                let y = py + t1 * dy;
                if (y >= by && y <= by + bh) { minT = t1; hit = {x: bx, y: y, nx: 1, ny: 0, dist: t1 * Math.hypot(dx, dy)}; }
            }
            let t2 = ((bx + bw) - px) / dx;
            if (t2 > 0.01 && t2 < minT) {
                let y = py + t2 * dy;
                if (y >= by && y <= by + bh) { minT = t2; hit = {x: bx + bw, y: y, nx: -1, ny: 0, dist: t2 * Math.hypot(dx, dy)}; }
            }
        }
        if (dy !== 0) {
            let t3 = (by - py) / dy;
            if (t3 > 0.01 && t3 < minT) {
                let x = px + t3 * dx;
                if (x >= bx && x <= bx + bw) { minT = t3; hit = {x: x, y: by, nx: 0, ny: 1, dist: t3 * Math.hypot(dx, dy)}; }
            }
            let t4 = ((by + bh) - py) / dy;
            if (t4 > 0.01 && t4 < minT) {
                let x = px + t4 * dx;
                if (x >= bx && x <= bx + bw) { minT = t4; hit = {x: x, y: by + bh, nx: 0, ny: -1, dist: t4 * Math.hypot(dx, dy)}; }
            }
        }
        return hit;
    }

    static reflect(dx, dy, nx, ny) {
        const dot = dx * nx + dy * ny;
        return {
            dx: dx - 2 * dot * nx,
            dy: dy - 2 * dot * ny
        };
    }

    // Normalize angle to [-PI, PI]
    static normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }
}
