function DocGist($) {
    'use strict';
    var DEFAULT_SOURCE = decodeURIComponent('github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc');
    var DEFAULT_HIGHLIGHTER = 'codemirror';
    var UNAVAILABLE_HIGHLIGHTERS = ['coderay', 'pygments', 'source-highlight', 'highlight'];
    var ASCIIDOCTOR_DEFAULT_ATTRIBUTES = {
        'coderay-unavailable': '',
        'compat-mode!': '@',
        'doctype!': '@',
        'env-docgist': '',
        'env': 'docgist',
        'example-caption!': '@',
        'experimental': '@',
        'icons': 'font',
        'no-highlight!': '@',
        'numbered!': '@',
        'platform-opal': '',
        'platform': 'opal',
        'pygments-unavailable': '',
        'sectanchors': '@',
        'showcomments': '@',
        'showtitle': '@',
        'source-highlighter': DEFAULT_HIGHLIGHTER + '@',
        'stem': 'asciimath@',
        'stylesdir': 'style@',
        'stylesheet': 'asciidoctor.css@',
        'table-caption': '@',
        'toc': '@',
        'toclevels': '2@',
        'version-label!': '@'
    };
    var THEMES = {
        'asciidoctor': 'Asciidoctor',
        'colony': 'Colony',
        'foundation': 'Foundation',
        'foundation-lime': 'Foundation (Lime)',
        'foundation-potion': 'Foundation (Potion)',
        'github': 'GitHub',
        'golo': 'Golo',
        'iconic': 'Iconic',
        'maker': 'Maker',
        'old-standard': 'Old Standard',
        'readthedocs': 'Read the Docs',
        'riak': 'Riak',
        'rocket-panda': 'Rocket Panda',
        'rubygems': 'RubyGems'
    };
    var THEMES_WITH_DARK_SOURCE_BLOCKS = [
        'style/github.css',
        'style/iconic.css',
        'style/rubygems.css'
    ];

    var $content;
    var $footer;
    var $gistId;
    var $editor;
    var $editButton;
    var $saveButton;
    var $footerWrapper;

    var useLocalStorage = isLocalStorageWritable();

    var gist = new Gist($);
    var editor;

    var urlInfo = undefined;
    var urlAttributes;
    var id;

    function initFromUrl() {
        urlInfo = getUrlAttributes();
        urlAttributes = urlInfo.attributes;
        id = urlInfo.id;
    }

    initFromUrl();

    gist.getGistAndRenderPage(renderContent, urlInfo.id, DEFAULT_SOURCE);

    $(document).ready(function () {
        if (top.location != self.location) {
            $('#main-menu').css('display', 'none');
        }
        $content = $('#content');
        $footer = $('#footer-text');
        $gistId = $('#gist-id');
        $editor = $('#editor');
        $editButton = $('#edit-button');
        $saveButton = $('#save-button');
        $footerWrapper = $('#footer');

        $gistId.keydown(gist.readSourceId);
    });

    function getAsciidoctorOptions(overrides, urlOverrides, extraOptions) {
        var attributes = $.extend({}, ASCIIDOCTOR_DEFAULT_ATTRIBUTES, urlOverrides, overrides);
        var attributeList = [];
        for (var key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                attributeList.push(key + '=' + attributes[key]);
            }
        }
        var opts = $.extend({
            'to_file': false,
            'safe': 'secure',
            'attributes': attributeList
        }, extraOptions);
        return Opal.hash(opts);
    }

    function getUrlAttributes() {
        // from http://stackoverflow.com/a/2880929/36710
        var attributes = {};
        var match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, ' '));
            },
            query = window.location.search.substring(1);

        var first = undefined;
        while (match = search.exec(query)) {
            if (!first) {
                first = decode(match[1]);
            } else {
                attributes[decode(match[1])] = decode(match[2]);
            }
        }
        if (!first) {
            first = '';
        }
        return {'id': first, 'attributes': attributes};
    }

    function preProcess(content, options) {
        var preOptions = {};
        var highlighter = undefined;
        var sourceLanguage = undefined;
        var doc = Opal.Asciidoctor.$load(content, getAsciidoctorOptions(undefined, undefined, {'parse_header_only': true}));
        var attributes = doc.attributes;
        var attributeOverrides = {};
        preOptions['attributes'] = attributes;
        preOptions['document'] = doc;

        // merge urlAttributes into attributes
        for (var key in urlAttributes) {
            if (!urlAttributes.hasOwnProperty(key)) {
                continue;
            }
            if (key.charAt(0) === '!') {
                attributes.$delete(key.slice(1));
            } else if (key.slice(-1) === '!') {
                attributes.$delete(key.slice(0, -1));
            } else {
                attributes.$delete('!' + key);
                attributes.$delete(key + '!');
            }
            attributes.$store(key, urlAttributes[key]);
        }

        var stylesheet = '';
        if (attributes['$has_key?']('stylesheet')) {
            stylesheet = attributes.$fetch('stylesheet');
            if (attributes['$has_key?']('stylesdir')) {
                var stylesdir = attributes.$fetch('stylesdir');
                if (stylesdir) {
                    if (stylesdir.slice(-1) !== '/') {
                        stylesdir += '/';
                    }
                    stylesheet = stylesdir + stylesheet;
                }
            }
        }
        preOptions['stylesheet'] = stylesheet;
        preOptions['hasDarkSourceBlocks'] = $.inArray(stylesheet, THEMES_WITH_DARK_SOURCE_BLOCKS) !== -1;

        if (attributes['$has_key?']('source-highlighter')) {
            highlighter = attributes.$fetch('source-highlighter').toLowerCase();
            if ($.inArray(highlighter, UNAVAILABLE_HIGHLIGHTERS) !== -1) {
                console.log('Syntax highlighter not supported by DocGist: "' + highlighter + '", using "' + DEFAULT_HIGHLIGHTER + '" instead.');
                attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
                highlighter = DEFAULT_HIGHLIGHTER;
            }
        } else {
            attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
            highlighter = DEFAULT_HIGHLIGHTER;
        }
        preOptions['highlighter'] = highlighter;

        if (attributes['$has_key?']('source-language')) {
            sourceLanguage = attributes.$fetch('source-language').toLowerCase();
        } else if (attributes['$has_key?']('language')) {
            sourceLanguage = attributes.$fetch('language').toLowerCase();
        }
        preOptions['sourceLanguage'] = sourceLanguage;

        if ('imageBaseLocation' in options || 'siteBaseLocation' in options) {
            if (attributes['$has_key?']('imagesdir')) {
                // only alter relative values, not URLs
                var imagesdir = attributes.$fetch('imagesdir');
                if (imagesdir.slice(-1) === '/') {
                    // root-relative URL
                    if ('siteBaseLocation' in options) {
                        attributeOverrides['imagesdir'] = options['siteBaseLocation'] + imagesdir;
                    }
                } else if ('imageBaseLocation' in options && imagesdir.substr(0, 4) !== 'http') {
                    // relative URL
                    attributeOverrides['imagesdir'] = options['imageBaseLocation'] + '/' + imagesdir;
                }
            } else if ('imageBaseLocation' in options) {
                // default to the same location as the document
                attributeOverrides['imagesdir'] = options['imageBaseLocation'];
            }
        }

        preOptions['asciidoctorOptions'] = getAsciidoctorOptions(attributeOverrides, urlAttributes);
        return preOptions;
    }

    var JAVASCRIPT_HREF = /^\s*javascript\s*:/i;

    function sanitizeAndInjectHtml(html) {
        var items = $.parseHTML(html);
        for (var i = items.length; i--;) {
            if (items[i].nodeType === 1) {
                clean(items[i]);
                var nestedItems = items[i].getElementsByTagName('*');
                for (var j = nestedItems.length; j--;) {
                    clean(nestedItems[j]);
                }
            }
        }
        $content.empty();
        $content.append(items);

        function clean(element) {
            for (var i = element.attributes.length; i--;) {
                var attrib = element.attributes[i];
                if (attrib.name.slice(0, 2) === 'on') {
                    element.removeAttribute(attrib.name);
                } else if (attrib.name === 'href' && JAVASCRIPT_HREF.test(attrib.value)) {
                    element.removeAttribute(attrib.name);
                }
            }
        }
    }

    var executedOnce = false;

    function renderContent(content, options, fromEditor) {
        var html, preOptions, attributes;
        var mathJaxConfigured = false;
        if (fromEditor) {
            initFromUrl();
        }
        try {
            preOptions = preProcess(content, options);
            attributes = preOptions['attributes'];
            html = Opal.Asciidoctor.$convert(content, preOptions['asciidoctorOptions']);
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>' + '<p>' + e.fileName + ':' + e.lineNumber + ':'
                + e.columnNumber + '</p>' + '<pre>' + e.stack + '</pre>'
            );
            return;
        }

        $(document).ready(function () {

            if (attributes['$has_key?']('no-header-footer')) {
                $('#main-menu').css('display', 'none');
            }
            if (preOptions['stylesheet']) {
                var $themeStylesheet = $('#theme-stylesheet');
                if ($themeStylesheet.attr('href') !== preOptions['stylesheet']) {
                    $themeStylesheet.attr('href', preOptions['stylesheet']);
                }
            }
            sanitizeAndInjectHtml(html);
            $gistId.val('');

            postProcess($content, options, preOptions);

            addMetadataToFooter(attributes);

            if (!mathJaxConfigured) {
                MathJax.Hub.Configured();
                mathJaxConfigured = true;
            }
            MathJax.Hub.Queue(['Typeset', MathJax.Hub, $content.get(0)]);
            if ('sourceUrl' in options) {
                $('#gist-link').attr('href', options['sourceUrl']).parent().removeClass('disabled');
            }
            share();

            if (fromEditor) {
                editor.setPreOptions(preOptions);
                return;
            }

            if (executedOnce) {
                return;
            }
            executedOnce = true;

            loadHighlightMenu(preOptions['highlighter']);
            loadThemeMenu(preOptions['stylesheet']);
            loadAttributesMenu();

            if (!editor) {
                editor = new Editor();
            }
            editor.setPreOptions(preOptions);

            loadNewMenu(content, options, setupEditMode);

            if ('editor' in options) {
                setupEditMode(options);
            }

            function setupEditMode(optionsToUse, click) {
                var editorModeInProgress = false;
                $editButton.click(function (e) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    if (!editorModeInProgress) {
                        editorModeInProgress = true;
                        if ($editButton.hasClass('active')) {
                            $editButton.removeClass('active');
                            $saveButton.children('span').text('Save');
                            editor.unload(optionsToUse, editorModeDone);
                        } else {
                            $editButton.addClass('active');
                            if (optionsToUse['editor'] === 'firepad') {
                                $saveButton.children('span').text('Saved continuously');
                            } else if (optionsToUse['editor'] === 'gist') {
                                $saveButton.children('span').text('Save');
                            }
                            editor.load(optionsToUse, editorModeDone);
                        }
                    } else {
                        // ignore clicks until we're done
                    }

                    function editorModeDone() {
                        editorModeInProgress = false;
                    }
                }).removeClass('disabled');
                if (click) {
                    $editButton.click();
                }
            }

            if ('save' in options) {
                $saveButton.click(function () {
                    editor.save(options);
                }).parent().removeClass('disabled');
            }
        });
    }

    function postProcess($content, options, preOptions) {
        var attributes = preOptions['attributes'];

        if ('imageContentReplacer' in options) {
            options['imageContentReplacer']($content);
        }

        // not only going by id here is due to
        // https://github.com/asciidoctor/asciidoctor/issues/1582
        // a fix should be in 1.5.4
        $('div.toc').each(function () {
            var $toc = $(this);
            if ($toc.children('ul').length === 0) {
                $toc.hide();
            }
        });

        if (!attributes['$has_key?']('experimental!')) {
            transformButtons($content);
        }

        if ('highlighter' in preOptions && !attributes['$has_key?']('no-highlight')) {
            applyHighlighting(preOptions['highlighter'], preOptions['sourceLanguage'], preOptions['hasDarkSourceBlocks']);
        }

        tabTheSource($content);

        // fix root-relative locations
        if ('siteBaseLocation' in options) {
            $('img[src ^= "/"]', $content).each(function () {
                this.src = options['siteBaseLocation'] + this.getAttribute('src');
            });
            $('a[href ^= "/"]', $content).each(function () {
                this.href = options['siteBaseLocation'] + this.getAttribute('href');
            });
        }

        if ('interXrefReplacer' in options || 'includeReplacer' in options) {
            $('a[href]', $content).each(function () {
                var href = this.getAttribute('href');
                if (href.length) {
                    if ('interXrefReplacer' in options) {
                        options['interXrefReplacer'](this, href);
                    }
                    if ('includeReplacer' in options) {
                        options['includeReplacer'](this, href);
                    }
                }
            });
        }

        if (preOptions['stylesheet'] === 'style/iconic.css') {
            $('h1').css('margin-bottom', '3rem');
            $('.paragraph.lead > p, #preamble > .sectionbody > .paragraph:first-of-type p').css('color', 'inherit');
        }

        setPageTitle(preOptions['document']);
    }

    function loadNewMenu(content, options, setupFunc) {
        $('#new-empty').click(function () {
            loadNewEditor();
        });
        $('#new-copy').click(function () {
            options['new-firepad-content'] = content;
            loadNewEditor();
        });

        function loadNewEditor() {
            var myId = id ? id : '';
            var buffer = new Array(16);
            uuid.v4(null, buffer);
            var base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            var bs62 = baseX(base62);
            var tmpId = bs62.encode(buffer);
            historyTransition(myId, 'fp-' + tmpId);
            options['editor'] = 'firepad';
            setupFunc(options, true);
        }

        window.onpopstate = function (event) {
            if ('state' in event && typeof event.state === 'string') {
                window.location.assign(event.state);
            }
        };
    }

    function historyTransition(oldId, newId) {
        window.history.replaceState('?' + oldId, null, '?' + oldId);
        window.history.pushState('?' + newId, null, '?' + newId);
        id = newId;
    }

    function isLocalStorageWritable() {
        try {
            var storage = window.localStorage;
            var tmp = '__storage_test__';
            storage.setItem(tmp, tmp);
            storage.removeItem(tmp);
            return true;
        }
        catch (e) {
            return false;
        }
    }

    function Editor() {
        var asciidoctorOptions;
        var $contentWrapper = $('#content-wrapper');
        var $editorWrapper = $('#editor-wrapper');
        var showcomments;
        var firebase;
        var firepad;
        var content;
        var originalContent;
        var startTime;
        var cm;
        var ghToken;
        var ghUsername;
        var ghScope;
        var userId;
        var ghAuthExpires;
        var preOptions;
        var onChangesFunc;
        var timeout;

        function setPreOptions(preOpts) {
            preOptions = preOpts;
            asciidoctorOptions = preOptions['asciidoctorOptions'];
            showcomments = preOptions['attributes']['$has_key?']('showcomments');
        }

        function readGithubAuthData() {
            if (useLocalStorage) {
                var storage = window.localStorage;
                if ('ghAuthExpires' in storage && Date.now() / 1000 + 3600 < storage['ghAuthExpires']) {
                    userId = storage['userId'];
                    ghUsername = storage['ghUsername'];
                    ghToken = storage['ghToken'];
                    ghScope = storage['ghScope'];
                    ghAuthExpires = storage['ghAuthExpires'];
                }
            }
        }

        function writeGithubAuthData() {
            if (useLocalStorage) {
                var storage = window.localStorage;
                storage['userId'] = userId;
                storage['ghUsername'] = ghUsername;
                storage['ghToken'] = ghToken;
                storage['ghScope'] = ghScope;
                storage['ghAuthExpires'] = ghAuthExpires;
            }
        }

        function load(options, doneFunc) {
            $contentWrapper.addClass('editing');
            if (showcomments) {
                $contentWrapper.addClass('showcomments');
            }
            $editorWrapper.addClass('editing');
            $footerWrapper.hide();
            cm = CodeMirror.fromTextArea($editor.get(0), {
                'mode': 'asciidoc',
                'theme': 'elegant',
                'lineWrapping': true,
                'autofocus': true,
                'lineNumbers': true
            });

            if (typeof firebase === 'undefined') {
                firebase = new Firebase(window.FIREBASE_URL);
            }
            Firebase.goOnline();

            readGithubAuthData();

            var scope = undefined;
            var scopeDef = undefined;
            if (options['editor'] === 'gist') {
                scope = {'scope': 'gist'};
                scopeDef = 'gist';
            } else {
                scope = {};
                scopeDef = 'default';
            }
            if (userId && (ghScope === 'gist' || ghScope === scopeDef)) {
                initializeEditor();
            } else {
                performAuth(firebase, options['editor'], scope, successGithub, successFirebase, fail);
            }

            function successGithub(auth) {
                ghUsername = auth.github.username;
                ghToken = auth.github.accessToken;
                userId = ghUsername;
                ghAuthExpires = auth.expires;
                ghScope = scopeDef;
                writeGithubAuthData();
                initializeEditor();
            }

            function successFirebase(auth) {
                userId = auth.uid;
                initializeEditor();
            }

            function fail(message, err) {
                console.log(message, err);
            }

            function performAuth(fireb, editor, scope, succGithub, succFireb, fail) {
                fireb.authWithOAuthPopup('github', function (ghError, ghAuthData) {
                    if (ghError) {
                        if (editor === 'gist') {
                            fail('GitHub login failed!', ghError);
                        } else {
                            fireb.authAnonymously(function (error, authData) {
                                if (error) {
                                    fail('Anonymous login Failed!', error);
                                } else {
                                    succFireb(authData);
                                }
                            });
                        }
                    } else {
                        succGithub(ghAuthData);
                    }
                }, scope);
            }

            function initializeEditor() {
                if (options['editor'] === 'firepad') {
                    initializeFirepad(userId);
                } else if (options['editor'] === 'gist') {
                    setupRenderingOnChanges();
                    cm.setValue(originalContent = options['gist-content']);
                } else {
                    console.log('Unknown editor: ' + options['editor']);
                }
            }

            function initializeFirepad(userId) {
                firepad = Firepad.fromCodeMirror(firebase.child(id.slice(3)), cm, {
                    'defaultText': '= DocGist collaborative AsciiDoc editor\n\n' +
                    'TIP: Share the URL with others to collaborate!',
                    'userId': userId
                });
                firepad.on('ready', function () {
                    if ('new-firepad-content' in options && firepad.isHistoryEmpty()) {
                        firepad.setText(options['new-firepad-content']);
                    }
                    $('a.powered-by-firepad').remove();
                });
                setupRenderingOnChanges();
            }

            function setupRenderingOnChanges() {
                var timeDiff = 1;
                var MAGIC_PERFORMANCE_FACTOR = 2;
                cm.on('changes', renderOnChanges);

                function renderOnChanges() {
                    if (typeof timeout === 'undefined') {
                        var wait = timeDiff * MAGIC_PERFORMANCE_FACTOR;
                        timeout = setTimeout(function () {
                            clearTimeout(timeout);
                            timeout = undefined;
                            timeDiff = renderEditorContent(showcomments, options);
                            console.log(Math.floor(timeDiff));
                        }, wait);
                    }
                }

                onChangesFunc = renderOnChanges;
                if (typeof doneFunc === 'function') {
                    doneFunc();
                }
            }
        }

        function renderEditorContent(showcomments, options) {
            startTime = performance.now();
            content = originalContent = cm.getValue();
            if (showcomments) {
                content = content.replace(/^\/\/\s*?(\w*?):\s*?(.*?)$/gm, function (match, name, comment) {
                    comment = $.trim(comment);
                    if (name) {
                        if (comment === '') {
                            return '[.commenter]#' + name + '#';
                        } else {
                            return '[.commenter]#' + name + '# [.comment]#[.commenter]_' + name + '_ ' + comment + '#';
                        }
                    } else {
                        return '[.comment]#' + comment + '#';
                    }
                });
            }
            renderContent(content, options, true);
            return performance.now() - startTime;
        }

        function unload(options, doneFunc) {
            cm.off('changes', onChangesFunc);
            if (typeof timeout !== 'undefined') {
                clearTimeout(timeout);
                timeout = undefined;
            }
            if (showcomments) {
                renderContent(content, options);
            }
            if (options['editor'] === 'gist') {
                options['gist-content'] = originalContent;
            }
            if (firepad) {
                firepad.dispose();
                firepad = undefined;
                Firebase.goOffline();
            }
            $contentWrapper.removeClass('editing');
            $contentWrapper.removeClass('showcomments');
            $editorWrapper.removeClass('editing');
            $editorWrapper.children('.CodeMirror').remove();
            cm = undefined;
            $footerWrapper.show();
            if (typeof doneFunc === 'function') {
                doneFunc();
            }
        }

        function save(options) {
            if (typeof options['save'] === 'function') {
                options['save'](ghUsername, ghToken, originalContent, function (result) {
                    if ('newId' in result) {
                        historyTransition(id, result['newId']);
                    }
                    if ('sourceUrl' in result) {
                        $('#gist-link').attr('href', result['sourceUrl']);
                    }
                });
            }
        }

        return {
            'load': load,
            'unload': unload,
            'save': save,
            'setPreOptions': setPreOptions
        }
    }

    function addMetadataToFooter(attributes) {
        if (attributes['$has_key?']('no-header-footer')) {
            $footer.css('display', 'none');
            return;
        } else {
            $footer.css('display', 'block');
        }
        var $ITEM = $('<i/>');
        var $SPAN = $('<span/>');
        $footer.empty();

        function addMetadataItem(keys, description, icon, valueTransformers) {
            var iconAdded = false;
            for (var ix = 0; ix < keys.length; ix++) {
                var key = keys[ix];
                if (attributes['$has_key?'](key)) {
                    var value = attributes.$fetch(key);
                    if (icon && !iconAdded) {
                        iconAdded = true;
                        $footer.append($ITEM.clone().addClass('fa fa-' + icon).prop('title', description));
                    }
                    var $span = $SPAN.clone().text(value);
                    if ($.isArray(valueTransformers)) {
                        for (var i = 0; i < valueTransformers.length; i++) {
                            valueTransformers[i](value, $span);
                        }
                    }
                    $footer.append($span);
                }
            }
        }

        function wrapInEmail(key) {
            return function (value, $element) {
                if (attributes['$has_key?'](key)) {
                    var address = attributes.$fetch(key);
                    $element.wrapInner('<a href="mailto:' + address + '">');
                }
            };
        }

        function wrapInLinkWithValue(baseUrl) {
            return function (value, $element) {
                $element.wrapInner('<a href="' + baseUrl + value + '">');
            };
        }

        function wrapInLink(baseUrl) {
            return function (value, $element) {
                $element.wrapInner('<a href="' + baseUrl + '">');
            };
        }

        function prepend(str) {
            return function (value, $element) {
                $element.text(str + value);
            };

        }

        if (attributes['$has_key?']('authorcount')) {
            var authorCount = attributes.$fetch('authorcount');
            if (authorCount === 1) {
                addMetadataItem(['author'], 'Author', 'user', [wrapInEmail('email')]);
            } else {
                var first = true;
                for (var authorIndex = 1; authorIndex <= authorCount; authorIndex++) {
                    addMetadataItem(['author_' + authorIndex], 'Author', (first ? 'user' : false), [wrapInEmail('email_' + authorIndex)]);
                    first = false;
                }
            }
        }

        addMetadataItem(['twitter'], 'Twitter', 'twitter', [wrapInLinkWithValue('https://twitter.com/')]);
        addMetadataItem(['github'], 'GitHub', 'github', [wrapInLinkWithValue('https://github.com/')]);
        addMetadataItem(['revnumber', 'revdate', 'revremark'], 'Version', 'thumb-tack');
        addMetadataItem(['tags', 'keywords'], 'Tags/Keywords', 'tags');
        addMetadataItem(['asciidoctor-version'], 'Powered by', 'bolt', [prepend('Asciidoctor '), wrapInLink('http://asciidoctor.org/')]);
        addMetadataItem(['env'], 'Powered by', 'pencil-square-o', [wrapInLink(window.location.href)]);
    }

    function transformButtons($content) {
        var $BUTTON = $('<button class="btn btn-default btn-xs" type="buton"/>');
        $('b.button', $content).each(function () {
            var $old = $(this);
            var text = $old.text();
            var $new = $BUTTON.clone().text(text);
            $old.replaceWith($new);
        });
    }

    function tabTheSource($content) {
        var $UL = $('<ul class="nav nav-tabs" role="tablist"/>');
        var $LI = $('<li role="presentation"/>');
        var $A = $('<a role="tab" data-toggle="tab" style="text-decoration:none;"/>');
        var $WRAPPER = $('<div class="tab-content content"/>');
        var snippets = [];
        var languageEventElements = {};
        $('div.tabbed-example', $content).each(function () {
            var $exampleBlock = $(this);
            var title = $exampleBlock.children('div.title', this).first().text();
            var languages = [];
            var $languageBlocks = {};
            $('div.listingblock', this).each(function () {
                var language = $('code', this).data('lang');
                languages.push(language);
                $languageBlocks[language] = $(this);
            });
            if (languages.length > 1) {
                snippets.push({
                    '$exampleBlock': $exampleBlock,
                    'languages': languages,
                    '$languageBlocks': $languageBlocks
                });
            }
        });
        var idNum = 0;
        for (var ix = 0; ix < snippets.length; ix++) {
            var snippet = snippets[ix];
            var languages = snippet.languages;
            var $languageBlocks = snippet.$languageBlocks;
            var $exampleBlock = snippet.$exampleBlock;
            var idBase = 'tabbed-example-' + idNum++;
            var $wrapper = $WRAPPER.clone();
            var $ul = $UL.clone();
            for (var i = 0; i < languages.length; i++) {
                var language = languages[i];
                var $langContent = $($languageBlocks[language]);
                var id;
                if ($langContent.attr('id')) {
                    id = $langContent.attr('id');
                } else {
                    id = idBase + '-' + language;
                    $langContent.attr('id', id);
                }
                $langContent.addClass('tab-pane').css('position', 'relative');
                var $li = $LI.clone();
                var $a = $A.clone();
                $a.attr('href', '#' + id).text(language).data('lang', language).on('shown.bs.tab', function (e) {
                    var language = $(e.target).data('lang');
                    var $elements = languageEventElements[language];
                    for (var j = 0; j < $elements.length; j++) {
                        $elements[j].tab('show');
                    }
                });
                if (language in languageEventElements) {
                    languageEventElements[language].push($a);
                } else {
                    languageEventElements[language] = [$a];
                }
                $wrapper.append($langContent);
                if (i === 0) {
                    $li.addClass('active');
                    $langContent.addClass('active');
                }
                $li.append($a);
                $ul.append($li);
            }
            $exampleBlock.children('div.content').first().replaceWith($ul);
            $exampleBlock.append($wrapper);
        }
    }

    function setPageTitle(doc) {
        document.title = doc.$doctitle(Opal.hash({'sanitize': true, 'use_fallback': true}));
        if (useLocalStorage) {
            var $LI = $('<li/>');
            var $A = $('<a href="javascript:;" target="_blank"/>');
            var items = undefined;
            if (window.localStorage.recent) {
                items = window.localStorage.recent.split('|');
            } else {
                items = [];
            }
            var newItems = encode(id, document.title);
            var $menu = $('#file-menu');
            for (var i = 0; i < items.length; i++) {
                var item = decode(items[i]);
                if (item.id !== id) {
                    newItems += '|' + items[i];
                }
                var $a = $A.clone().text(item.title).attr('href', '?' + item.id);
                $LI.clone().append($a).appendTo($menu);
            }
            window.localStorage.recent = newItems;
        }

        function encode(id, title) {
            return encodeURIComponent(id) + '#' + encodeURIComponent(title);
        }

        function decode(item) {
            var parts = item.split('#');
            return {'id': decodeURIComponent(parts[0]), 'title': decodeURIComponent(parts[1])};
        }
    }

    function share() {
        var title = document.title;
        var href = encodeURIComponent(window.location.href);
        $('#twitter-share').attr('href',
            'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check this out: ' + title) + '&url=' + href);
        $('#facebook-share').attr('href', 'http://www.facebook.com/share.php?u=' + href);
        $('#google-plus-share').attr('href', 'https://plus.google.com/share?url=' + href);
    }

    function getUrlWithAttributes(toAdd, toRemove) {
        var url = '?';
        // we treat the id as separate from the attributes
        url += id ? id : DEFAULT_SOURCE;
        // add back existing attributes minus ones we want to get rid of
        for (var key in urlAttributes) {
            if (urlAttributes.hasOwnProperty(key) && keyToKeep(key)) {
                url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(urlAttributes[key]);
            }
        }
        // add attributes we want added
        for (var keyToAdd in toAdd) {
            if (toAdd.hasOwnProperty(keyToAdd)) {
                url += '&' + encodeURIComponent(keyToAdd) + '=' + encodeURIComponent(toAdd[keyToAdd]);
            }
        }
        // always add back the hash
        url += window.location.hash;
        // resolve relative url to absolute
        var a = document.createElement('a');
        a.href = url;
        return a.href;

        function keyToKeep(key) {
            if (key in toAdd || $.inArray(key, toRemove) !== -1) {
                return false;
            }
            if (key.slice(-1) === '!') {
                var keyWithoutNegation = key.slice(0, -1);
                if (keyWithoutNegation in toAdd || $.inArray(keyWithoutNegation, toRemove) !== -1) {
                    return false;
                }
            } else {
                var keyPlusNegation = key + '!';
                if (keyPlusNegation in toAdd || $.inArray(keyPlusNegation, toRemove) !== -1) {
                    return false;
                }
            }
            return true;
        }
    }

    function applyHighlighting(highlighter, sourceLanguage, hasDarkSourceBlocks) {
        var AVAILABLE_HIGHLIGHTERS = {
            'highlightjs': highlightUsingHighlightjs,
            'highlight.js': highlightUsingHighlightjs,
            'prettify': highlightUsingPrettify,
            'codemirror': highlightUsingCodeMirror
        };

        if (sourceLanguage) {
            $('code.src', $content).each(function () {
                $(this).data('lang', sourceLanguage).addClass('src-' + sourceLanguage).removeClass('src');
            });
        }

        if (highlighter in AVAILABLE_HIGHLIGHTERS) {
            AVAILABLE_HIGHLIGHTERS[highlighter](hasDarkSourceBlocks);
        } else {
            console.log('Unknown syntax highlighter "' + highlighter + '", using "' + DEFAULT_HIGHLIGHTER + '" instead.');
            // not in IE8
            if ('keys' in Object) {
                console.log('Recognized highlighter names: ' + Object.keys(AVAILABLE_HIGHLIGHTERS));
            }
            AVAILABLE_HIGHLIGHTERS[DEFAULT_HIGHLIGHTER](hasDarkSourceBlocks);
        }
    }

    function highlightUsingPrettify(hasDarkSourceBlocks) {
        $('link.dark').attr('disabled', !hasDarkSourceBlocks);
        $('code[class^="language-"],code[class^="src-"]', $content).each(function (i, e) {
            e.className = e.className.replace('src-', 'language-') + ' prettyprint';
        });
        window.PR.prettyPrint();
    }

    function highlightUsingCodeMirror(hasDarkSourceBlocks) {
        CodeMirror.colorize(undefined, undefined, hasDarkSourceBlocks);
    }

    function highlightUsingHighlightjs(hasDarkSourceBlocks) {
        $('link.dark').attr('disabled', !hasDarkSourceBlocks);
        $('code[class^="language-"],code[class^="src-"]', $content).each(function (i, e) {
            e.className = e.className.replace('src-', 'language-');
            hljs.highlightBlock(e);
            var $e = $(e);
            var $parent = $e.parent('pre.highlight');
            var language = $e.data('lang');
            if (!language) {
                var matches = e.className.match(/language-([a-z]*)/);
                if (matches.length === 2) {
                    language = matches[1];
                }
            }
            if ($parent.length === 0) {
                $e.css('display', 'inline').addClass(language).css('padding', 0);
            } else {
                $parent.addClass(language);
            }
        });
    }

    function createAttributeAndValueTransformer(attribute, attributesToRemove, sliceMinus, valueTransformer) {
        return function (name) {
            // -5 slice to remove the @ after the default value
            var sliceRemove = typeof sliceMinus === 'number' ? sliceMinus : -1;
            if (name === ASCIIDOCTOR_DEFAULT_ATTRIBUTES[attribute].slice(0, sliceRemove)) {
                // this a hack
                attributesToRemove.push(attribute);
                return {};
            } else {
                var attributeObject = {};
                attributeObject[attribute] = typeof valueTransformer === 'function' ? valueTransformer(name) : name;
                return attributeObject;
            }
        };
    }

    function loadThemeMenu(stylesheet) {
        var menuId = 'theme-menu';
        var currentStyle = '';
        if (stylesheet && stylesheet.indexOf('style/') === 0) {
            currentStyle = stylesheet.slice(6, -4);
        }
        var currentStyles = currentStyle ? [currentStyle] : [];
        var attribute = 'stylesheet';
        var attributesToRemove = ['stylesdir'];
        var valueTransformer = function (name) {
            return name + '.css'
        };
        var attributeAndValueTransformer = createAttributeAndValueTransformer(attribute, attributesToRemove, -5, valueTransformer);
        loadMenu(menuId, THEMES, currentStyles, attribute, attributesToRemove, undefined, attributeAndValueTransformer);
    }

    function loadHighlightMenu(highlighter) {
        var menuId = 'highlighter-menu';
        var HIGHLIGHTERS = {
            'codemirror': 'CodeMirror',
            'highlightjs': 'highlight.js',
            'prettify': 'Prettify'
        };
        var currentNames = highlighter ? [highlighter] : [];
        var attribute = 'source-highlighter';
        var attributesToRemove = [];
        var attributeAndValueTransformer = createAttributeAndValueTransformer(attribute, attributesToRemove);
        loadMenu(menuId, HIGHLIGHTERS, currentNames, attribute, attributesToRemove, undefined, attributeAndValueTransformer);
    }

    function loadAttributesMenu() {
        var menuId = 'attributes-menu';
        // null is used to unset values
        var ATTRIBUTES = {
            'compat-mode': ['', null],
            'doctype': ['article', 'book', null],
            'example-caption': ['', null],
            'experimental': ['', null],
            'no-header-footer': [''],
            'no-highlight': ['', null],
            'numbered': ['', null],
            'stem': ['asciimath', 'latexmath', ''],
            'table-caption': ['', null],
            'toc': ['', 'macro', 'preamble', null],
            'toclevels': ['1', '2', '3', '4']
        };
        var menuItems = {};
        $.each(ATTRIBUTES, function (key, values) {
            $.each(values, function (ix, value) {
                var isNegated = value === null;
                var isEmpty = value === '';
                if (isNegated) {
                    menuItems[key + '!='] = ':' + key + '!:';
                } else {
                    menuItems[key + '=' + value] = ':' + key + (isEmpty ? ':' : ': ' + value);
                }
            });
        });
        var currentNames = [];
        $.each(urlAttributes, function (key, value) {
            currentNames.push(key + '=' + value);
            if (value === '') {
                currentNames.push(key);
            }
        });
        $.each(ASCIIDOCTOR_DEFAULT_ATTRIBUTES, function (key, value) {
            if (value.slice(-1) === '@') {
                // check that we don't turn off both variants
                if (key.slice(-1) === '!' && $.inArray(key.slice(0, -1), currentNames) !== -1) {
                    return true; // continue
                }
                if (key.slice(-1) !== '!' && $.inArray(key, currentNames) !== -1) {
                    return true; // continue
                }
                var found = false;
                $.each(currentNames, function (ix, entry) {
                    if (entry.indexOf(key) === 0) {
                        found = true;
                        return false; // break
                    }
                });
                if (!found) {
                    var val = value.slice(0, -1);
                    currentNames.push(key + '=' + val);
                    if (val === '') {
                        currentNames.push(key);
                    }
                }
            }
        });
        var attributesToRemove = [];
        var attributeAndValueTransformer = function (name) {
            var key, value;
            var pieces = name.split('!=');
            if (pieces.length < 2) {
                pieces = name.split('=');
                if (pieces.length < 2) {
                    return {};
                }
                key = pieces[0];
                value = pieces.slice(1).join('=');
            } else {
                key = pieces[0] + '!';
                value = pieces.slice(1).join('!=');
            }
            var attributeObject = {};
            if (keyToAdd(key, value)) {
                attributeObject[key] = value;
            } else {
                // this is a hack
                attributesToRemove.push(key);
            }
            return attributeObject;

            function keyToAdd(key, value) {
                if (key in ASCIIDOCTOR_DEFAULT_ATTRIBUTES) {
                    var defaultValue = ASCIIDOCTOR_DEFAULT_ATTRIBUTES[key];
                    if (defaultValue.slice(-1) === '@') {
                        defaultValue = defaultValue.slice(0, -1);
                    }
                    return value !== defaultValue;
                }
                return true;
            }
        };
        loadMenu(menuId, menuItems, currentNames, null, attributesToRemove, null, attributeAndValueTransformer);
    }

    function loadMenu(menuId, menuItems, currentNames, attribute, attributesToRemove, valueTransformer, attributeAndValueTransformer) {
        var $LI = $('<li/>');
        var $A = $('<a href="javascript:;"/>');
        var $menu = $('#' + menuId);

        $.each(menuItems, function (name, descriptiveName) {
            var $a = $A.clone().text(descriptiveName);
            var $li = $LI.clone().append($a).appendTo($menu);
            if ($.inArray(name, currentNames) !== -1) {
                $li.addClass('disabled');
            } else {
                $a.click(function () {
                    var attributeObject = {};
                    if (typeof attributeAndValueTransformer === 'function') {
                        attributeObject = attributeAndValueTransformer(name);
                    } else {
                        attributeObject[attribute] = (typeof valueTransformer === 'function') ? valueTransformer(name) : name;
                    }
                    var url = getUrlWithAttributes(attributeObject, attributesToRemove);
                    window.location.assign(url);
                    return false;
                });
            }
        });
    }

    function errorMessage(message, gist) {
        var messageText;
        if (gist) {
            messageText = 'Somethng went wrong fetching "' + gist + '":<p>' + message + '</p>';
        }
        else {
            messageText = '<p>' + message + '</p>';
        }

        $(document).ready(function () {
            $content.html('<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>');
        });
    }
}

DocGist(jQuery);
