import CoreMotion
import Foundation

/// Phone tilt, reduced to what the water needs. Reads device-motion gravity, which needs no
/// permission and never leaves the device. Without motion hardware (Simulator) tilt stays at rest.
final class TiltMotion {
    struct Sample {
        /// Direction "down" points on screen, in radians from straight down (positive = toward the right edge).
        var angle: Double
        /// How fast the tilt is changing, smoothed; drives sloshing.
        var agitation: Double
        /// Accumulated wave phase; advances faster in the direction of tilt.
        var phase: Double
    }

    private let manager = CMMotionManager()
    private var gravityX = 0.0
    private var gravityY = -1.0
    private var angle = 0.0
    private var agitation = 0.0
    private var phase = 0.0
    private var lastStep: TimeInterval?

    #if DEBUG
    /// Lets the Simulator, which has no gyro, exercise the tilt response.
    var debugAngle: Double?
    #endif

    func start() {
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 30
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let g = motion?.gravity else { return }
            self?.gravityX = g.x
            self?.gravityY = g.y
        }
    }

    func stop() { manager.stopDeviceMotionUpdates() }

    /// Advances smoothing and phase to `now`; call once per rendered frame.
    func step(now: TimeInterval) -> Sample {
        let dt = min(max(now - (lastStep ?? now), 0), 0.1)
        lastStep = now

        var target = atan2(gravityX, -gravityY)
        // Held flat, "down" is out of the screen and the angle is meaningless; fade it out.
        let inPlane = hypot(gravityX, gravityY)
        target *= min(1, max(0, (inPlane - 0.15) / 0.35))
        #if DEBUG
        if let debugAngle { target = debugAngle }
        #endif
        target = min(max(target, -1.3), 1.3)

        let previous = angle
        angle += (target - angle) * min(1, dt * 6)
        let speed = dt > 0 ? abs(angle - previous) / dt : 0
        agitation += (min(speed, 3) - agitation) * min(1, dt * 4)
        phase += dt * (0.9 + angle * 2.4)
        return Sample(angle: angle, agitation: agitation, phase: phase)
    }
}
