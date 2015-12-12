'use strict';

function DocGist($) {
    var DEFAULT_SOURCE = decodeURIComponent('github-asciidoctor%2Fdocgist%2F%2Fgists%2Fexample.adoc');
    var DOCGIST_LIB_VERSIONS = {
        'prettify': 'r298',
        'highlightjs': '8.9.1',
        'mathjax': '2.5.3'
    };
    window.DocgistLibVersions = DOCGIST_LIB_VERSIONS;
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
        'showtitle': '@',
        'source-highlighter': DEFAULT_HIGHLIGHTER + '@',
        'stem': 'asciimath@',
        'stylesdir': 'style@',
        'stylesheet': 'asciidoctor.css@',
        'table-caption': '@',
        'toc': 'macro',
        'version-label!': '@'
    };

    var $content = undefined;
    var $footer = undefined;
    var $gistId = undefined;
    var $shortUrlDialog = undefined;
    var urlAttributes = undefined;
    var id = undefined;

    $(document).ready(function () {
        if (top.location != self.location) {
            $('body>div.navbar').css('display', 'none');
        }
        $shortUrlDialog = $('#share-short-url-form').hide();
        $content = $('#content');
        $footer = $('#footer-text');
        $gistId = $('#gist-id');


        var gist = new Gist($, $content);
        var urlInfo = getUrlAttributes();
        urlAttributes = urlInfo.attributes;
        id = urlInfo.id;
        gist.getGistAndRenderPage(renderContent, urlInfo.id, DEFAULT_SOURCE);
        $gistId.keydown(gist.readSourceId);
    });

    function getAsciidoctorOptions(overrides, urlOverrides) {
        var attributes = $.extend({}, ASCIIDOCTOR_DEFAULT_ATTRIBUTES, urlOverrides, overrides);
        var attributeList = [];
        for (var key in attributes) {
            attributeList.push(key + '=' + attributes[key]);
        }
        return Opal.hash({
            'to_file': false,
            'safe': 'secure',
            'attributes': attributeList
        });
    }

    function getUrlAttributes() {
        // from http://stackoverflow.com/a/2880929/36710
        var attributes = {};
        var match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, " "));
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
        return {'id': first, 'attributes': attributes};
    }

    function existsInObjectOrHash(key, hash, object) {
        if (key in object) {
            return true;
        } else {
            return hash['$has_key?'](key);
        }
    }

    function getValueFromObjectOrHash(key, hash, object) {
        if (key in object) {
            return object[key];
        } else {
            return hash.$fetch(key);
        }
    }

    function renderContent(content, options) {
        if ('sourceUrl' in options) {
            $('#gist-link').attr('href', options['sourceUrl']);
        }
        $content.empty();
        var doc, html = undefined;
        var highlighter = undefined;
        var sourceLanguage = undefined;
        try {
            doc = Opal.Asciidoctor.$load(content, getAsciidoctorOptions({'parse_header_only': 'true'}));
            var attributes = doc.attributes;
            var attributeOverrides = {};

            if (existsInObjectOrHash('no-header-footer', attributes, urlAttributes)) {
                $('body>div.navbar').css('display', 'none');
            }

            var stylesheet = '';
            if (existsInObjectOrHash('stylesheet', attributes, urlAttributes)) {
                stylesheet = getValueFromObjectOrHash('stylesheet', attributes, urlAttributes);
                if (existsInObjectOrHash('stylesdir', attributes, urlAttributes)) {
                    var stylesdir = getValueFromObjectOrHash('stylesdir', attributes, urlAttributes);
                    if (stylesdir) {
                        if (stylesdir.slice(-1) !== '/') {
                            stylesdir += '/';
                        }
                        stylesheet = stylesdir + stylesheet;
                    }
                }
                addLinkElement(stylesheet);
            }

            if (existsInObjectOrHash('source-highlighter', attributes, urlAttributes)) {
                highlighter = getValueFromObjectOrHash('source-highlighter', attributes, urlAttributes).toLowerCase();
                if ($.inArray(highlighter, UNAVAILABLE_HIGHLIGHTERS) !== -1) {
                    console.log('Syntax highlighter not supported by DocGist: "' + highlighter + '", using "' + DEFAULT_HIGHLIGHTER + '" instead.');
                    attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
                    highlighter = DEFAULT_HIGHLIGHTER;
                }
            } else {
                attributeOverrides['source-highlighter'] = DEFAULT_HIGHLIGHTER;
                highlighter = DEFAULT_HIGHLIGHTER;
            }

            if (existsInObjectOrHash('source-language', attributes, urlAttributes)) {
                sourceLanguage = getValueFromObjectOrHash('source-language', attributes, urlAttributes).toLowerCase();
            } else if (existsInObjectOrHash('language', attributes, urlAttributes)) {
                sourceLanguage = getValueFromObjectOrHash('language', attributes, urlAttributes).toLowerCase();
            }

            if ('imageBaseLocation' in options || 'siteBaseLocation' in options) {
                if (existsInObjectOrHash('imagesdir', attributes, urlAttributes)) {
                    // only alter relative values, not URLs
                    var imagesdir = getValueFromObjectOrHash('imagesdir', attributes, urlAttributes);
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

            html = Opal.Asciidoctor.$convert(content, getAsciidoctorOptions(attributeOverrides, urlAttributes));
        }
        catch (e) {
            errorMessage(e.name + ':' + '<p>' + e.message + '</p>');
            return;
        }
        $content.html(html);
        $gistId.val('');

        tabTheSource($content);

        if ('imageContentReplacer' in options) {
            options['imageContentReplacer']($content);
        }

        var hasDarkSourceBlocks = $.inArray(stylesheet, ['style/github.css', 'style/iconic.css', 'style/rubygems.css']) !== -1;
        if (highlighter && !existsInObjectOrHash('no-highlight', attributes, urlAttributes)) {
            applyHighlighting(highlighter, sourceLanguage, hasDarkSourceBlocks);
        }
        loadHighlightMenu(highlighter);

        if (stylesheet === 'style/iconic.css') {
            $('h1').css('margin-bottom', '3rem');
        }

        if (!existsInObjectOrHash('stem!', attributes, urlAttributes)) {
            appendMathJax();
        }
        if (!existsInObjectOrHash('experimental!', attributes, urlAttributes)) {
            transformButtons($content);
        }
        setPageTitle(doc);

        addMetadataToFooter(attributes, urlAttributes);

        // fix root-relative locations
        if ('siteBaseLocation' in options) {
            $('img[src ^= "/"]', $content).each(function () {
                this.src = options['siteBaseLocation'] + this.getAttribute('src');
            });
            $('a[href ^= "/"]', $content).each(function () {
                this.href = options['siteBaseLocation'] + this.getAttribute('href');
            });
        }

        if ('interXrefReplacer' in options) {
            $('a[href]', $content).each(function () {
                var href = this.getAttribute('href');
                options['interXrefReplacer'](this, href);
            });
        }

        share();
        loadThemeMenu(stylesheet);
        loadAttributesMenu();
    }

    function addMetadataToFooter(attributes, urlAttributes) {
        if (existsInObjectOrHash('no-header-footer', attributes, urlAttributes)) {
            $footer.css('display', 'none');
            return;
        } else {
            $footer.css('display', 'block');
        }
        var $ITEM = $('<i/>');
        var $SPAN = $('<span/>');

        function addMetadataItem(keys, description, icon, valueTransformers) {
            var iconAdded = false;
            for (var ix in keys) {
                var key = keys[ix];
                if (existsInObjectOrHash(key, attributes, urlAttributes)) {
                    var value = getValueFromObjectOrHash(key, attributes, urlAttributes);
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
                if (existsInObjectOrHash(key, attributes, urlAttributes)) {
                    var address = getValueFromObjectOrHash(key, attributes, urlAttributes);
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

        if (existsInObjectOrHash('authorcount', attributes, urlAttributes)) {
            var authorCount = getValueFromObjectOrHash('authorcount', attributes, urlAttributes);
            var first = true;
            for (var authorIndex = 1; authorIndex <= authorCount; authorIndex++) {
                addMetadataItem(['author_' + authorIndex], 'Author', (first ? 'user' : false), [wrapInEmail('email_' + authorIndex)]);
                first = false;
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
                var $content = $($languageBlocks[language]);
                var id;
                if ($content.attr('id')) {
                    id = $content.attr('id');
                } else {
                    id = idBase + '-' + language;
                    $content.attr('id', id);
                }
                $content.addClass('tab-pane').css('position', 'relative');
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
                $wrapper.append($content);
                if (i === 0) {
                    $li.addClass('active');
                    $content.addClass('active');
                }
                $li.append($a);
                $ul.append($li);
            }
            $exampleBlock.children('div.content').first().replaceWith($ul);
            $exampleBlock.append($wrapper);
        }
    }

    function setPageTitle(doc) {
        document.title = doc.$doctitle(Opal.hash({'sanitize': true, 'use_fallback': true}))
    }

    function share() {
        var title = document.title;
        var href = encodeURIComponent(window.location.href);
        $('#twitter-share').attr('href',
            'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Check this out: ' + title) + '&url=' + href);
        $('#facebook-share').attr('href', 'http://www.facebook.com/share.php?u=' + href);
        $('#google-plus-share').attr('href', 'https://plus.google.com/share?url=' + href);

        var $urlField = $('#share-url').click(function () {
            $(this).select();
        });
        $shortUrlDialog.modal({'show': false}).on('shown.bs.modal', function () {
            $urlField.select();
        });

        $('#google-short-url-share')
            .click(function () {
                getShortUrl(window.location.href, function (data) {
                    setUrlField(data);
                });
                $shortUrlDialog.modal('show');
            });

        $('#short-url-remove-header-footer').click(function () {
            if (this.checked) {
                var url = getUrlWithAttributes({'no-header-footer': ''}, ['no-header-footer']);
                getShortUrl(url, function (data) {
                    setUrlField(data);
                });
            }
        });

        function setUrlField(data) {
            if ('id' in data) {
                $urlField.val(data.id);
                $urlField.select();
                $shortUrlDialog.modal('show');
            } else {
                $urlField.val('An error occurred while creating the short URL.');
            }
        }
    }

    function getUrlWithAttributes(toAdd, toRemove) {
        var url = '?';
        // we treat the id as separate from the attributes
        url += id ? id : DEFAULT_SOURCE;
        // add back existing attributes minus ones we want to get rid of
        for (var key in urlAttributes) {
            if (keyToKeep(key)) {
                url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(urlAttributes[key]);
            }
        }
        // add attributes we want added
        for (var keyToAdd in toAdd) {
            url += '&' + encodeURIComponent(keyToAdd) + '=' + encodeURIComponent(toAdd[keyToAdd]);
        }
        // always add bach the hash
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

    function getShortUrl(url, success) {
        $.ajax({
            'type': 'POST',
            'url': 'https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyD6ZzkU7DQiYZgWC1azw_DCRvqyszGHKh4',
            'data': '{"longUrl": "' + url + '"}',
            'success': success,
            'dataType': 'json',
            'crossDomain': true,
            'headers': {'Content-Type': 'application/json'}
        });
    }

    function appendMathJax() {
        var mathJaxJsScriptConfig = document.createElement('script');
        mathJaxJsScriptConfig.type = 'text/x-mathjax-config';
        mathJaxJsScriptConfig.text =
            'MathJax.Hub.Config({' +
            '  tex2jax: {' +
            '    inlineMath: [["\\\\(", "\\\\)"]],' +
            '    displayMath: [["\\\\[", "\\\\]"]],' +
            '    ignoreClass: "nostem|nostem|nolatexmath"' +
            '  },' +
            '  asciimath2jax: {' +
            '    delimiters: [["\\\\$", "\\\\$"]],' +
            '    ignoreClass: "nostem|nostem|noasciimath"' +
            '  }' +
            '});';
        document.head.appendChild(mathJaxJsScriptConfig);

        var version = DOCGIST_LIB_VERSIONS.mathjax;
        addScriptElement('https://cdnjs.cloudflare.com/ajax/libs/mathjax/' + version + '/MathJax.js?config=TeX-MML-AM_HTMLorMML');
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

    function addScriptElement(url) {
        var element = document.createElement('script');
        element.type = 'text/javascript';
        element.async = true;
        element.src = url;
        var first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(element, first);
    }

    function addLinkElement(url) {
        var element = document.createElement('link');
        element.rel = 'stylesheet';
        element.href = url;
        var linkElements = document.getElementsByTagName('link');
        var last = linkElements[linkElements.length - 1];
        last.parentNode.insertBefore(element, last);
    }

    function highlightUsingPrettify(hasDarkSourceBlocks) {
        $('code[class^="language-"],code[class^="src-"]', $content).each(function (i, e) {
            e.className = e.className.replace('src-', 'language-') + ' prettyprint';
        });
        var version = DOCGIST_LIB_VERSIONS.prettify;
        addScriptElement('//cdnjs.cloudflare.com/ajax/libs/prettify/' + version + '/run_prettify.min.js');
        if (hasDarkSourceBlocks) {
            addLinkElement('//google-code-prettify.googlecode.com/svn/loader/skins/desert.css');
        }
    }

    function highlightUsingCodeMirror(hasDarkSourceBlocks) {
        CodeMirror.colorize(undefined, undefined, hasDarkSourceBlocks);
    }

    function highlightUsingHighlightjs(hasDarkSourceBlocks) {
        if (hasDarkSourceBlocks) {
            addLinkElement('//cdnjs.cloudflare.com/ajax/libs/highlight.js/' + DOCGIST_LIB_VERSIONS.highlightjs + '/styles/darkula.min.css');
        }
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

    function loadThemeMenu(stylesheet) {
        var menuId = 'theme-menu';
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
        var currentStyle = '';
        if (stylesheet && stylesheet.indexOf('style/') === 0) {
            currentStyle = stylesheet.slice(6, -4);
        }
        var currentStyles = currentStyle ? [currentStyle] : [];
        var attribute = 'stylesheet';
        var attributesToRemove = ['stylesdir'];
        var valueTransformer = function (name) {
            return name + '.css';
        };
        loadMenu(menuId, THEMES, currentStyles, attribute, attributesToRemove, valueTransformer);
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
        loadMenu(menuId, HIGHLIGHTERS, currentNames, attribute, attributesToRemove);
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
            'stem': ['asciimath', 'latexmath', '', null],
            'table-caption': ['', null],

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

        $content.html('<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>');
    }
}

DocGist(jQuery);
