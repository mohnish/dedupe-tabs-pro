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

### Profiling

Profiling is a hidden local developer flag. Enable it from the extension service worker console:

```js
chrome.storage.local.set({ profilingEnabled: true })
```

Disable it with:

```js
chrome.storage.local.set({ profilingEnabled: false })
```

When enabled, performance logs are written with the `[Dedupe Tabs Pro profile]` prefix.

## Release

* Implement feature/bugfix
* `make dist`
* Test locally and ensure everything works and there are no regressions
* `git changelog` -> write up the changelog
* Commit changes in the `History.md`
* `git release 1.0.0`

## License

(The MIT License)

Copyright (c) 2026 Mohnish Thallavajhula &lt;hi@iam.mt&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
