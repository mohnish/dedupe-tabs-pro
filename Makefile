ZIP_NAME := dedupe_tabs_pro.zip

validate:
	@node --check src/background.js
	@node --check src/options.js
	@node --check src/popup.js
	@node --check src/changelog.js
	@node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"

dist: validate
	@rm -fr dist
	@mkdir -p dist
	@rm -f $(ZIP_NAME)
	@cp manifest.json dist/
	@cp -R src dist/
	@cd dist && zip -r ../$(ZIP_NAME) .

clean:
	rm -fr ./dist/ ./$(ZIP_NAME)

.PHONY: validate dist clean
