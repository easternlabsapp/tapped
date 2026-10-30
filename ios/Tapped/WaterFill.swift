import SwiftUI

/// Water filling the orb. The surface stays level with the world as the phone tilts, and the
/// waves drift in the direction of the tilt.
struct WaterFill: View {
    let animated: Bool

    @State private var tilt = TiltMotion()

    var body: some View {
        TimelineView(.animation(paused: !animated)) { context in
            let sample = animated
                ? tilt.step(now: context.date.timeIntervalSinceReferenceDate)
                : TiltMotion.Sample(angle: 0, agitation: 0, phase: 0.6)
            Canvas { ctx, size in draw(&ctx, size: size, sample: sample) }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { if animated { tilt.start() } }
        .onDisappear { tilt.stop() }
        .onChange(of: animated) { _, on in if on { tilt.start() } else { tilt.stop() } }
        #if DEBUG
        .overlay { DebugTiltPad(tilt: tilt) }
        #endif
    }

    private func draw(_ ctx: inout GraphicsContext, size: CGSize, sample: TiltMotion.Sample) {
        let d = size.width
        ctx.translateBy(x: size.width / 2, y: size.height / 2)
        // Draw as if upright, then rotate so "down" follows gravity.
        ctx.rotate(by: .radians(-sample.angle))

        let layers: [(color: Color, level: Double, amp: Double, wavelength: Double, speed: Double, offset: Double)] = [
            (Color(hex: 0x7BE8F2).opacity(0.55), 0.60, 0.030, 1.10, 0.8, 0.0),
            (Theme.aqua.opacity(0.70), 0.54, 0.038, 0.80, -1.1, 1.7),
            (Theme.aquaDeep.opacity(0.85), 0.47, 0.045, 0.62, 1.4, 3.1),
        ]
        let slosh = 1 + sample.agitation * 1.6

        for layer in layers {
            var path = Path()
            let top = d * (0.5 - layer.level)
            let amp = d * layer.amp * slosh
            let k = 2 * Double.pi / (d * layer.wavelength)
            var x = -d
            path.move(to: CGPoint(x: x, y: d))
            while x <= d {
                let y = top + amp * sin(k * x + sample.phase * layer.speed + layer.offset)
                path.addLine(to: CGPoint(x: x, y: y))
                x += 5
            }
            path.addLine(to: CGPoint(x: d, y: d))
            path.closeSubpath()
            ctx.fill(path, with: .color(layer.color))
        }

        // Glass highlight so the orb still reads as a sphere; fixed to the screen, not the water.
        ctx.rotate(by: .radians(sample.angle))
        let highlight = CGRect(x: -0.32 * d, y: -0.42 * d, width: 0.5 * d, height: 0.2 * d)
        ctx.fill(
            Path(ellipseIn: highlight),
            with: .linearGradient(
                Gradient(colors: [.white.opacity(0.35), .white.opacity(0)]),
                startPoint: CGPoint(x: 0, y: highlight.minY), endPoint: CGPoint(x: 0, y: highlight.maxY)))
    }
}

#if DEBUG
/// Simulator-only: drag across the orb to fake a tilt.
private struct DebugTiltPad: View {
    let tilt: TiltMotion

    var body: some View {
        Color.clear
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { value in tilt.debugAngle = Double(value.translation.width) / 60 }
                    .onEnded { _ in tilt.debugAngle = nil }
            )
    }
}
#endif
