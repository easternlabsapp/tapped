import SwiftUI
import UIKit

struct ContentView: View {
    @State private var model = LookupViewModel(
        locator: CoreLocationZipLocator(), service: APIStatusService(), places: GeocoderPlaceResolver())
    @FocusState private var zipFocused: Bool
    @State private var showingAbout = false

    var body: some View {
        ZStack {
            WaterBackground()
            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        Text("Tapped")
                            .font(Theme.rounded(.title3, weight: .heavy))
                            .foregroundStyle(.white.opacity(0.9))
                            .padding(.top, 12)

                        // Idle: centre the orb. Result/message: pin it near the top.
                        Spacer(minLength: compact ? 24 : 16).frame(maxHeight: compact ? 24 : .infinity)

                        OrbButton(appearance: orbAppearance, diameter: compact ? 130 : 230) {
                            zipFocused = false
                            Task { await model.locate() }
                        }

                        if case .idle = model.phase {
                            Text("Tap to find the water around you")
                                .font(Theme.rounded(.subheadline, weight: .medium))
                                .foregroundStyle(Theme.secondaryText)
                                .padding(.top, 44)
                        }

                        if compact {
                            Panel(phase: model.phase, placeName: model.placeName)
                                .padding(.top, 28)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }

                        Spacer(minLength: 24)

                        ZipField(text: $model.zipInput, focused: $zipFocused, disabled: model.isBusy) {
                            zipFocused = false
                            Task { await model.lookUpTypedZip() }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
                    .frame(minHeight: geo.size.height)
                    .contentShape(Rectangle())
                    .onTapGesture { zipFocused = false }
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button { showingAbout = true } label: {
                Image(systemName: "info.circle")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 44, height: 44)
            }
            .padding(.trailing, 8)
            .accessibilityLabel("About and data sources")
        }
        .sheet(isPresented: $showingAbout) { AboutView() }
        .preferredColorScheme(.dark)
        .animation(.spring(duration: 0.6, bounce: 0.2), value: compact)
        .onChange(of: model.phase) { _, phase in
            guard case .result(let response) = phase else { return }
            UINotificationFeedbackGenerator().notificationOccurred(response.status == .green ? .success : .warning)
        }
    }

    /// The orb is big until there's something to show underneath it.
    private var compact: Bool {
        switch model.phase {
        case .idle, .locating, .loading: false
        default: true
        }
    }

    private var orbAppearance: OrbButton.Appearance {
        switch model.phase {
        case .idle: .idle
        case .locating: .working("Finding you…")
        case .loading: .working("Checking records…")
        case .result(let response): .status(response.status)
        case .permissionDenied, .locationUnavailable, .notCovered, .error: .neutral
        }
    }
}

// MARK: - Manual ZIP entry (secondary action)

private struct ZipField: View {
    @Binding var text: String
    var focused: FocusState<Bool>.Binding
    let disabled: Bool
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            TextField("", text: $text, prompt: Text("or enter a ZIP code").foregroundStyle(Theme.secondaryText))
                .keyboardType(.numberPad)
                .focused(focused)
                .font(Theme.rounded(.body, weight: .medium))
                .foregroundStyle(.white)
                .padding(.leading, 18)
                .accessibilityLabel("ZIP code")
            Button(action: submit) {
                Image(systemName: "arrow.right.circle.fill").font(.system(size: 32))
                    .foregroundStyle(disabled ? Theme.secondaryText : Theme.aqua)
            }
            .disabled(disabled)
            .accessibilityLabel("Check this ZIP code")
            .padding(.trailing, 6)
        }
        .frame(height: 52)
        .background(.white.opacity(0.1), in: Capsule())
        .overlay(Capsule().strokeBorder(.white.opacity(0.18)))
    }
}

// MARK: - Result / message panel under the orb

private struct Panel: View {
    let phase: LookupViewModel.Phase
    let placeName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch phase {
            case .result(let response): ResultContent(response: response, placeName: placeName)
            case .permissionDenied:
                Message("Location access is off. Enter a ZIP code below, or allow location in Settings.")
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
                .font(Theme.rounded(.body, weight: .semibold)).foregroundStyle(Theme.aqua)
            case .locationUnavailable:
                Message("Couldn't determine your ZIP code. Enter one below instead.")
            case .notCovered:
                Message("Not covered yet. Tapped only covers US locations for now.")
            case .error(let text):
                Message(text)
            default:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.ultraThinMaterial.opacity(0.7), in: RoundedRectangle(cornerRadius: Theme.cardRadius))
        .overlay(RoundedRectangle(cornerRadius: Theme.cardRadius).strokeBorder(.white.opacity(0.14)))
    }
}

private struct Message: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(Theme.rounded(.body, weight: .medium)).foregroundStyle(.white)
    }
}

private struct ResultContent: View {
    let response: StatusResponse
    let placeName: String?

    var body: some View {
        if let placeName {
            Text(placeName).font(Theme.rounded(.title2, weight: .bold)).foregroundStyle(.white)
        }
        if let note = response.note {
            Text(note).font(Theme.rounded(.callout, weight: .medium)).foregroundStyle(Theme.note)
        }
        Text(response.summary).font(Theme.rounded(.body, weight: .medium)).foregroundStyle(.white)
        if !response.systems.isEmpty { SystemList(systems: response.systems) }
        if let disclaimer = response.disclaimer {
            Text(disclaimer).font(Theme.rounded(.caption)).foregroundStyle(Theme.secondaryText)
        }
    }
}

/// The water systems behind the result, each linking to its record at the source.
private struct SystemList: View {
    let systems: [WaterSystem]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Divider().overlay(.white.opacity(0.2))
            Text(systems.count > 1 ? "Water systems" : "Water system")
                .font(Theme.rounded(.headline, weight: .bold)).foregroundStyle(.white)
            ForEach(systems, id: \.pwsid) { system in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: system.status.symbol)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(system.status.onColor)
                        .frame(width: 20, height: 20)
                        .background(system.status.color, in: Circle())
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(system.name).font(Theme.rounded(.body, weight: .semibold)).foregroundStyle(.white)
                        Text("Serves about \(system.populationServed.formatted()) people")
                            .font(Theme.rounded(.caption)).foregroundStyle(Theme.secondaryText)
                        if let link = system.sourceUrl.flatMap(URL.init(string:)) {
                            Link("View EPA record at WaterViolations.org", destination: link)
                                .font(Theme.rounded(.caption, weight: .semibold)).tint(Theme.aqua)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(system.name), status \(system.status.accessibilityName)")
            }
        }
    }
}
