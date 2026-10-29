import SwiftUI

/// Credits, data sources, and the plain-language limits of what Tapped reports.
/// Required attribution for third-party data (see NOTICE.md in the repository).
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WaterBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        section("What Tapped shows") {
                            para("A summary of US drinking-water compliance records for your area. It is not a water test, and it does not guarantee that water is safe to drink. If you have health concerns, contact the local water utility.")
                        }
                        section("Data sources") {
                            para("Drinking-water violation records come from the US Environmental Protection Agency's Safe Drinking Water Information System, provided through WaterViolations.org.")
                            link("WaterViolations.org", "https://waterviolations.org")
                            para("Postal code data from GeoNames (geonames.org), licensed under Creative Commons Attribution 4.0.")
                            link("GeoNames", "https://www.geonames.org")
                            link("CC BY 4.0 license", "https://creativecommons.org/licenses/by/4.0/")
                        }
                        section("Your privacy") {
                            para("Your location is converted to a ZIP code on your device. Only the five-digit ZIP code is sent to Tapped's server; your coordinates are never sent to it.")
                        }
                        Text("Version \(version)")
                            .font(Theme.rounded(.footnote))
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.aqua)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(Theme.rounded(.headline, weight: .bold)).foregroundStyle(.white)
            content()
        }
    }

    private func para(_ text: String) -> some View {
        Text(text).font(Theme.rounded(.body)).foregroundStyle(Theme.secondaryText)
    }

    private func link(_ title: String, _ url: String) -> some View {
        Link(title, destination: URL(string: url)!)
            .font(Theme.rounded(.body, weight: .semibold))
            .foregroundStyle(Theme.aqua)
    }
}
