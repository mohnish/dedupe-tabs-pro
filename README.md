# Dedupe Tabs Pro
>A clean tab deduper for Chromium based browsers

## Features

- Review duplicate tab groups from the extension toolbar popup.
- Close all duplicate tabs with a keyboard shortcut.
- Close duplicates for one URL group at a time.
- Configure whether query parameters are ignored while matching duplicates.
- Configure whether duplicates are matched across all windows or only the active window.
- Show a toolbar badge when duplicate tabs are available to close.
- Show a changelog tab after extension updates.
- Include extension icons for Chrome surfaces and the toolbar.

## Development

1. Open `chrome://extensions` in a Chromium-based browser.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository.
4. Click the Dedupe Tabs Pro toolbar icon to close duplicate tabs.
5. Open the extension details page and choose **Extension options** to change dedupe behavior.

## Release

* Implement feature/bugfix
* `make dist`
* Test locally and ensure everything works and there are no regressions
* `git changelog` -> write up the changelog
* Commit changes in the `History.md`
* `git release 1.0.0`

## LICENSE

MIT
