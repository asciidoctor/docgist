// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
// Modified by the DocGist team.

"use strict";

CodeMirror.colorize = function (collection, defaultMode, isDark) {
    var isBlock = /^(p|li|div|h\\d|pre|blockquote|td)$/;

    function textContent(node, out) {
        if (node.nodeType == 3) return out.push(node.nodeValue);
        for (var ch = node.firstChild; ch; ch = ch.nextSibling) {
            textContent(ch, out);
            if (isBlock.test(node.nodeType)) out.push("\n");
        }
    }

    function run(node, mode, originalMode) {
        if (mode === "asciidoc" || mode === "cypher") {
            // no need to require those modes; we always load them
            applyMode(node, mode);
            return;
        }

        var found = false;
        for (var i = 0; i < CodeMirror.modeInfo.length; i++) {
            if (CodeMirror.modeInfo[i].mode === mode) {
                found = true;
                break;
            }
        }
        if (!found) {
            // avoid loading modes that don't exist
            return;
        }

        CodeMirror.requireMode(mode, function () {
            applyMode(node, originalMode ? originalMode : mode);
        });
    }

    function applyMode(node, mode) {
        var text = [];
        textContent(node, text);
        node.innerHTML = "";
        CodeMirror.runMode(text.join(""), mode, node);

        if (isDark) {
            node.className += " cm-s-midnight";
        } else {
            node.className += mode == "cypher" ? " cm-s-neo" : ( mode == "asciidoc" ? " cm-s-elegant" : " cm-s-default");
        }
    }

    if (!collection) collection = document.body.getElementsByTagName("code");

    for (var i = 0; i < collection.length; ++i) {
        var node = collection[i];
        var mode = node.getAttribute("data-lang");
        if (!mode) {
            var cls = node.className;
            if (cls && cls.indexOf("language-") === 0) {
                mode = cls.substr(9);
            } else if (cls && cls.indexOf("src-") === 0) {
                mode = cls.substr(4);
            } else {
                mode = defaultMode;
            }
        }
        if (!mode) continue;

        var originalMode = undefined;

        var info = CodeMirror.findModeByName(mode);
        if (info) {
            mode = info.mode;
            originalMode = info.mime;
        } else {
            info = CodeMirror.findModeByMIME(mode);
            if (info) {
                mode = info.mode;
                originalMode = info.mime;
            }
        }

        run(node, mode, originalMode);
    }
};
