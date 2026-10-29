import SwiftUI

/// Tapped's design language: deep water blues, soft rounded type, circles.
/// Red / yellow / green are reserved for water status and used nowhere else.
enum Theme {
    static let navy = Color(hex: 0x0B1F3A)
    static let deepTeal = Color(hex: 0x0E4C5A)
    static let aqua = Color(hex: 0x38D0E0)
    static let aquaDeep = Color(hex: 0x0A7FA6)
    static let note = Color(hex: 0xFFB454)          // "nearby ZIP" caveat; amber, distinct from status yellow
    static let secondaryText = Color.white.opacity(0.72)

    static let cardRadius: CGFloat = 24

    static func rounded(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

struct WaterBackground: View {
    var body: some View {
        LinearGradient(colors: [Theme.navy, Theme.deepTeal], startPoint: .top, endPoint: .bottom)
            .ignoresSafeArea()
    }
}

extension WaterStatus {
    var color: Color {
        switch self {
        case .green: Color(hex: 0x34D399)
        case .yellow: Color(hex: 0xFACC15)
        case .red: Color(hex: 0xF87171)
        case .unknown: Color(hex: 0x94A3B8)
        }
    }

    /// Symbol so status never relies on color alone.
    var symbol: String {
        switch self {
        case .green: "checkmark"
        case .yellow: "exclamationmark"
        case .red: "exclamationmark.triangle.fill"
        case .unknown: "questionmark"
        }
    }

    /// Foreground drawn on top of `color`.
    var onColor: Color { self == .yellow ? Theme.navy : .white }

    var accessibilityName: String {
        switch self {
        case .green: "green"
        case .yellow: "yellow"
        case .red: "red"
        case .unknown: "no data"
        }
    }
}
