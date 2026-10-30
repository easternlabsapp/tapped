import SwiftUI
import UIKit

/// The Locate button. Idle: a glowing orb with water ripples. Working: breathes.
/// After a result: the same orb becomes the status indicator.
struct OrbButton: View {
    enum Appearance: Equatable {
        case idle
        case working(String)
        case status(WaterStatus)
        case neutral          // errors / not covered: calm gray-blue, no verdict
    }

    let appearance: Appearance
    let diameter: CGFloat
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            orb
                // Ripples are a background so they can spill past the orb without affecting layout.
                .background { if showsRipples { Ripples(diameter: diameter, animated: !reduceMotion) } }
        }
        .buttonStyle(OrbPressStyle())
        .disabled(isWorking)
        .accessibilityLabel(accessibilityLabel)
    }

    private var orb: some View {
        let colors = gradientColors
        return Circle()
            .fill(RadialGradient(colors: colors, center: .init(x: 0.35, y: 0.28), startRadius: 4, endRadius: diameter * 0.8))
            .frame(width: diameter, height: diameter)
            .overlay { if showsRipples { WaterFill(animated: !reduceMotion).clipShape(Circle()) } }
            .overlay(Circle().strokeBorder(.white.opacity(0.28), lineWidth: 1.5))
            .shadow(color: colors.last!.opacity(0.55), radius: diameter * 0.16, y: diameter * 0.05)
            .overlay(content)
            .modifier(Breathing(active: isWorking && !reduceMotion))
    }

    @ViewBuilder private var content: some View {
        switch appearance {
        case .idle:
            VStack(spacing: 8) {
                Image(systemName: "location.fill").font(.system(size: diameter * 0.2, weight: .semibold))
                Text("Locate").font(.system(size: diameter * 0.17, weight: .heavy, design: .rounded))
            }
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
        case .working(let label):
            VStack(spacing: 10) {
                ProgressView().tint(.white).scaleEffect(1.2)
                Text(label).font(.system(size: diameter * 0.075, weight: .semibold, design: .rounded))
            }
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
        case .status(let status):
            Image(systemName: status.symbol)
                .font(.system(size: diameter * 0.42, weight: .bold))
                .foregroundStyle(status.onColor)
        case .neutral:
            Image(systemName: "location.slash.fill")
                .font(.system(size: diameter * 0.32, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
        }
    }

    private var gradientColors: [Color] {
        switch appearance {
        case .idle, .working: [Color(hex: 0x7BE8F2), Theme.aqua, Theme.aquaDeep]
        case .status(let s): [s.color.opacity(0.75), s.color, s.color.opacity(0.85)]
        case .neutral: [Color(hex: 0x6B8299), Color(hex: 0x425A72), Color(hex: 0x2C4157)]
        }
    }

    private var isWorking: Bool { if case .working = appearance { true } else { false } }
    private var showsRipples: Bool {
        switch appearance {
        case .idle, .working: true
        default: false
        }
    }

    private var accessibilityLabel: String {
        switch appearance {
        case .idle: "Locate"
        case .working(let label): label
        case .status(let s): "Status \(s.accessibilityName). Locate again"
        case .neutral: "Locate"
        }
    }
}

private struct OrbPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// Slow rings that expand and fade, like a drop landing on water.
private struct Ripples: View {
    let diameter: CGFloat
    let animated: Bool

    var body: some View {
        TimelineView(.animation(paused: !animated)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    let p = animated ? (t / 4 + Double(i) / 3).truncatingRemainder(dividingBy: 1) : Double(i + 1) / 4
                    Circle()
                        .strokeBorder(.white.opacity((1 - p) * 0.35), lineWidth: 2)
                        .frame(width: diameter, height: diameter)
                        .scaleEffect(1 + p * 0.8)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct Breathing: ViewModifier {
    let active: Bool

    func body(content: Content) -> some View {
        TimelineView(.animation(paused: !active)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            content.scaleEffect(active ? 1 + 0.03 * sin(t * 2.6) : 1)
        }
    }
}
