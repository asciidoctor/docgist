/**
 * Licensed to Neo Technology under one or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership. Neo Technology licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

'use strict';

function Gist($) {

    var DROPBOX_PUBLIC_BASE_URL = 'https://dl.dropboxusercontent.com/u/';
    var DROPBOX_PRIVATE_BASE_URL = 'https://www.dropbox.com/s/';
    var DROPBOX_PRIVATE_API_BASE_URL = 'https://dl.dropboxusercontent.com/s/';
    var GOOGLE_DOCS_BSE_URL = 'https://docs.google.com/document/d/';
    var RISEUP_BASE_URL = 'https://pad.riseup.net/p/';
    var RISEUP_EXPORT_POSTFIX = '/export/txt';
    var COPY_COM_PUBLIC_LINK = 'https://copy.com/';

    var VALID_GIST = /^[0-9a-f]{5,32}\/?$/;

    var internal = {};
    internal['sourceParsers'] = {
        'GitHub Gist': {
            'baseUrl': 'https://gist.github.com/', 'parse': function (gist, parts) {
                return useGithubGist(4, parts.length - 1, parts);
            }
        },
        'Raw GitHub Gist': {
            'baseUrl': 'https://gist.githubusercontent.com/', 'parse': function (gist, parts) {
                return useGithubGist(5, 4, parts);
            }
        },
        'GitHub Repository File': {
            'baseUrl': 'https://github.com/', 'parse': function (gist, parts) {
                return useGithubRepoParts({'branch': 6, 'path': 7}, parts);
            }
        },
        'Raw GitHub Repository File': {
            'baseUrl': ['https://raw.github.com/', 'https://raw.githubusercontent.com/'],
            'parse': function (gist, parts) {
                return useGithubRepoParts({'branch': 5, 'path': 6}, parts);
            }
        },
        'Public Dropbox File': {
            'baseUrl': DROPBOX_PUBLIC_BASE_URL, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('dropbox-', baseUrl, gist);
            }
        },
        'Shared Private Dropbox File': {
            'baseUrl': DROPBOX_PRIVATE_BASE_URL, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('dropboxs-', baseUrl, gist);
            }
        },
        'Copy.com Public Link': {
            'baseUrl': COPY_COM_PUBLIC_LINK, 'parse': function (gist, parts, baseUrl) {
                return useRestOfTheUrl('copy-', baseUrl, gist);
            }
        },
        'Google Docs Document': {
            'baseUrl': GOOGLE_DOCS_BSE_URL,
            'parse': useGoogleDoc
        },
        'Riseup Pad': {
            'baseUrl': RISEUP_BASE_URL, 'parse': function (gist, parts) {
                if (parts.length < 5) {
                    return {'error': 'No pad id in the URL.'};
                }
                var pad = parts[4];
                if (pad.length < 1) {
                    return {'error': 'Missing pad id in the URL.'};
                }
                return {'id': 'riseup-' + pad};
            }
        },
        'Etherpad': {
            'baseUrl': ['https://beta.etherpad.org/p/', 'https://piratepad.ca/p/', 'https://factor.cc/pad/p/', 'https://pad.systemli.org/p/', 'https://pad.fnordig.de/p/',
                'https://notes.typo3.org/p/', 'https://pad.lqdn.fr/p/', 'https://pad.okfn.org/p/', 'https://beta.publishwith.me/p/', 'https://pad.tihlde.org/p/',
                'https://etherpad.tihlde.org/p/', 'https://etherpad.wikimedia.org/p/', 'https://etherpad.fr/p/', 'https://piratenpad.de/p/', 'https://bitpad.co.nz/p/',
                'http://notas.dados.gov.br/p/', 'http://free.primarypad.com/p/', 'http://board.net/p/', 'https://pad.odoo.com/p/', 'http://pad.planka.nu/p/',
                'http://qikpad.co.uk/p/', 'http://pad.tn/p/', 'http://lite4.framapad.org/p/', 'http://pad.hdc.pw/p/'],
            'parse': function (gist, parts, baseUrl) {
                if (gist.length <= baseUrl.length) {
                    return {'error': 'No pad id in the URL.'};
                }
                var baseParts = baseUrl.split('/');
                var pad = parts[baseParts.length - 1];
                if (pad.length < 1) {
                    return {'error': 'Missing pad id in the URL.'};
                }
                var basePrefix = baseUrl.indexOf('https') === 0 ? 'eps' : 'ep';
                var prefix = '';
                if (baseUrl.indexOf('/p/') !== -1) {
                    prefix = 'p';
                } // intentionally no else
                if (baseUrl.indexOf('/pad/p/') !== -1) {
                    prefix = 'pp';
                } else if (baseUrl.indexOf('/etherpad/p/') !== -1) {
                    prefix = 'ep';
                }
                prefix = basePrefix + prefix + '-';
                return {'id': prefix + baseParts[2] + '-' + pad};
            }
        }
    };
    internal['fetchers'] = {
        'github-': fetchGithubFile,
        'dropbox-': fetchPublicDropboxFile,
        'dropboxs-': fetchPrivateDropboxFile,
        'copy-': fetchCopyComPublicLink,
        'gdoc-': fetchGoogleDoc,
        'riseup-': fetchRiseupFile,
        'eps-': fetchSecureEtherpadFile,
        'epsp-': fetchSecureEtherpadPDirFile,
        'epspp-': fetchSecureEtherpadPadPDirFile,
        'epsep-': fetchSecureEtherpadPadEtherpadDirFile,
        'epp-': fetchEtherpadPDirFile,
        'fp-': fetchFirepad
    };

    return {'getGistAndRenderPage': getGistAndRenderPage, 'readSourceId': readSourceId};

    function getGistAndRenderPage(renderer, source, defaultSource) {
        if (typeof source !== 'string' || source.length < 2) {
            source = defaultSource;
        }
        var fetcher = null;
        for (var fetch in internal.fetchers) {
            if (source.indexOf(fetch) === 0) {
                fetcher = internal.fetchers[fetch];
                break;
            }
        }
        if (!fetcher) {
            if (!VALID_GIST.test(source) && source.indexOf('://') !== -1) {
                fetcher = fetchAnyUrl;
            } else {
                fetcher = fetchGithubGist;
            }
        }
        fetcher(source, renderer, function (message) {
            errorMessage(message, source);
        });
    }

    function readSourceId(event) {
        if (event.which !== 13 && event.which !== 9) {
            return;
        }
        event.preventDefault();
        var $target = $(event.target);
        $target.blur();
        var gist = $.trim($target.val());
        if (gist.indexOf('/') !== -1) {
            var parts = gist.split('/');
            for (var sourceParserName in internal.sourceParsers) {
                var sourceParser = internal.sourceParsers[sourceParserName];
                var baseUrls = sourceParser.baseUrl;
                if (!Array.isArray(baseUrls)) {
                    baseUrls = [baseUrls];
                }
                for (var j = 0; j < baseUrls.length; j++) {
                    var baseUrl = baseUrls[j];
                    if (gist.indexOf(baseUrl) === 0) {
                        var result = sourceParser.parse(gist, parts, baseUrl);
                        if ('error' in result && result.error) {
                            errorMessage('Error when parsing "' + gist + '" as a ' + sourceParserName + '.\n' + result.error);
                        } else if ('id' in result) {
                            window.location.assign('?' + result.id);
                        }
                        return;
                    }
                }
            }
            if (gist.indexOf('://') !== -1) {
                gist = encodeURIComponent(gist);
            }
            else {
                errorMessage('Do not know how to parse "' + gist + '" as a DocGist source URL.');
            }
        }
        window.location.assign('?' + gist);
    }

    function useGithubGist(minLength, index, parts) {
        if (parts.length < minLength) {
            return {'error': 'No gist id in the URL.'};
        }
        var id = parts[index];
        if (!VALID_GIST.test(id)) {
            return {'error': 'No valid gist id in the url.'};
        }
        return {'id': id};
    }

    function useGithubRepoParts(indexes, parts) {
        var pathIndex = indexes['path'];
        var branchIndex = indexes['branch'];
        var organizationIndex = 3;
        var repoIndex = 4;
        if (parts.length >= pathIndex) {
            var id = 'github-' + parts[organizationIndex] + '/' + parts[repoIndex];
            if (parts[branchIndex] !== 'master') {
                id += '/' + parts[branchIndex];
            }
            id += '//' + parts.slice(pathIndex).join('/');
            id = encodeURIComponent(id);
            return {'id': id};
        } else {
            return {'error': 'Missing content in the URL.'};
        }
    }

    function useGoogleDoc(id, parts) {
        console.log(id, parts);
        if (parts.length < 6) {
            return {'error': 'No document id in the URL.'};
        }
        var doc = parts[5];
        if (doc.length < 1) {
            return {'error': 'Missing document id in the URL.'};
        }
        return {'id': 'gdoc-' + doc};
    }

    function useRestOfTheUrl(prefix, baseUrl, gist) {
        if (gist.length <= baseUrl.length) {
            return {'error': 'Missing content in the URL.'};
        }
        return {'id': prefix + encodeURIComponent(gist.substr(baseUrl.length))};
    }

    function fetchGithubGist(gist, success, error) {
        if (!VALID_GIST.test(gist)) {
            error('The gist id is malformed: ' + gist);
            return;
        }

        var url = 'https://api.github.com/gists/' + gist.replace("/", "");
        var ajaxOpts = {
            'url': url,
            'success': function (data) {
                var keys = searchForAttribute(data.files, 'language', 'AsciiDoc');
                if (keys.length === 0) {
                    keys = searchForAttribute(data.files, 'type', 'text/plain');
                }
                if (keys.length === 0) {
                    keys = [Object.keys(data.files)[0]];
                }
                var file = data.files[keys[0]];
                var content = file.content;
                var link = data.html_url;
                var svgs = extractImagesFromGithubGist(data.files);
                var options = {
                    'sourceUrl': link,
                    'editor': 'gist',
                    'gist-content': content,
                    'gist-filename': file.filename,
                    'gist-owner': data.owner.login,
                    'save': save
                };
                if (svgs) {
                    var magicPath = '__images__';
                    options['imageBaseLocation'] = magicPath;
                    options['imageContentReplacer'] = function replaceImages($content) {
                        addGithubImagesToContent($content, magicPath, svgs);
                    };
                    success(content, options);
                } else {
                    success(content, options);
                }

                function save(ghUsername, ghToken, content, resultFunc) {
                    if (ghUsername === options['gist-owner']) {
                        saveAsOwner();
                    } else {
                        $.ajax({
                            'url': url + '/forks',
                            'method': 'POST',
                            'headers': {
                                'Authorization': 'token ' + ghToken,
                                'Accept': 'application/vnd.github.v3+json'
                            },
                            'success': function (data) {
                                url = 'https://api.github.com/gists/' + data.id;
                                options['gist-owner'] = ghUsername;
                                saveAsOwner();
                                resultFunc({'newId': data.id, 'sourceUrl': data.html_url});
                            },
                            'error': function (xhr, status, errorMessage) {
                                console.log('error while forking', errorMessage);
                            }
                        });
                    }

                    function saveAsOwner() {
                        var dataToSend = {'files': {}};
                        dataToSend.files[options['gist-filename']] = {
                            'content': content
                        };
                        dataToSend = JSON.stringify(dataToSend);
                        $.ajax({
                            'url': url,
                            'method': 'PATCH',
                            'data': dataToSend,
                            'headers': {
                                'Authorization': 'token ' + ghToken,
                                'Accept': 'application/vnd.github.v3+json'
                            },
                            'success': function (data) {
                                console.log('success saving gist');
                            },
                            'error': function (xhr, status, errorMessage) {
                                console.log('error', errorMessage);
                            }
                        });
                    }
                }
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        };
        setGithubHeaders(ajaxOpts);
        $.ajax(ajaxOpts);
    }

    function isLocalStorageReadable() {
        try {
            var storage = window.localStorage;
            return true;
        }
        catch (e) {
            return false;
        }
    }

    function setGithubHeaders(opts) {
        if (isLocalStorageReadable()) {
            var storage = window.localStorage;
            if ('ghAuthExpires' in storage && Date.now() / 1000 + 3600 < storage['ghAuthExpires']) {
                if ('ghToken' in storage) {
                    opts['headers'] = {
                        'Authorization': 'token ' + storage['ghToken'],
                        'Accept': 'application/vnd.github.v3+json'
                    };
                }
            }
        }
    }

    function searchForAttribute(obj, prop, value) {
        var keys = [];
        for (var key in obj) {
            if (obj[key][prop] === value) {
                keys.push(key);
            }
        }
        return keys;
    }

    function extractImagesFromGithubGist(obj) {
        var keys = searchForAttribute(obj, 'language', 'SVG');
        var res = {};
        $.each(keys, function (ix, value) {
            res[value] = obj[value].content;
        });
        return res;
    }

    function addGithubImagesToContent($content, imageLocation, images) {
        $content.find('img').each(function () {
            if (this.src.indexOf(imageLocation) > 0) {
                var parts = this.src.split('/');
                var filename = parts.pop();
                var path = parts.pop();
                if (path === imageLocation && filename in images) {
                    $(this).replaceWith(images[filename]);
                }
            }
        });
    }

    function fetchGithubFile(gist, success, error) {
        gist = gist.substr(7);
        var parts = gist.split('/');
        var branch = 'master';
        var pathPartsIndex = 3;
        if (gist.indexOf('/contents/') !== -1) {
            window.location.assign('?github-' + encodeURIComponent(gist.replace('/contents/', '//')));
            return;
        }
        if (parts.length >= 4 && parts[3] === '') {
            branch = parts[2];
            pathPartsIndex++;
        }
        var url = 'https://api.github.com/repos/' + parts[0] + '/' + parts[1] + '/contents/' + parts.slice(pathPartsIndex).join('/');
        var ajaxOpts = {
            'url': url,
            'data': {'ref': branch},
            'success': function (data) {
                var content = Base64.decode(data.content);
                var link = data.html_url;
                // use cdn.rawgit.com instead ? see https://rawgit.com/faq
                // the behavior (images cached forever) might be too unexpected though
                var rootdir = 'https://rawgit.com/' + parts[0] + '/' + parts[1]
                    + '/' + branch;
                var imagesdir = rootdir + '/' + data.path.substr(0, data.path.length - data.name.length - 1);
                success(content, {
                    'sourceUrl': link,
                    'imageBaseLocation': imagesdir,
                    'siteBaseLocation': rootdir,
                    'interXrefReplacer': function (element, href) {
                        interXrefReplacer('github-' + gist, element, href);
                    },
                    'includeReplacer': function (element, href) {
                        includeReplacer('github-' + gist, element, href);
                    }
                });
            },
            'dataType': 'json',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        };
        setGithubHeaders(ajaxOpts);
        $.ajax(ajaxOpts);
    }

    function fetchPublicDropboxFile(id, success, error) {
        id = id.substr(8);
        fetchDropboxFile(id, success, error, DROPBOX_PUBLIC_BASE_URL, {
            'interXrefReplacer': function (element, href) {
                interXrefReplacer('dropbox-' + id, element, href);
            },
            'includeReplacer': function (element, href) {
                includeReplacer('dropbox-' + id, element, href);
            }
        });
    }

    function fetchPrivateDropboxFile(id, success, error) {
        id = id.substr(9);
        fetchDropboxFile(id, success, error, DROPBOX_PRIVATE_API_BASE_URL);
    }

    function fetchDropboxFile(id, success, error, baseUrl, options) {
        fetchFromUrl(baseUrl + id, success, error, options);
    }

    function fetchCopyComPublicLink(id, success, error) {
        id = id.substr(5);
        fetchFromUrl(COPY_COM_PUBLIC_LINK + id, success, error);
    }

    function fetchRiseupFile(id, success, error) {
        id = id.substr(7);
        var webUrl = RISEUP_BASE_URL + id;
        fetchFromUrl(webUrl + RISEUP_EXPORT_POSTFIX, success, error, {
            'sourceUrl': webUrl,
            'interXrefReplacer': function (element, href) {
                padInterXrefReplacer('riseup', element, href);
            }
        });
    }

    function fetchSecureEtherpadFile(id, success, error) {
        fetchEtherpad(id, success, error, true);
    }

    function fetchSecureEtherpadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'p');
    }

    function fetchSecureEtherpadPadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'pad/p');
    }

    function fetchSecureEtherpadPadEtherpadDirFile(id, success, error) {
        fetchEtherpad(id, success, error, true, 'etherpad/p');
    }

    function fetchEtherpadPDirFile(id, success, error) {
        fetchEtherpad(id, success, error, false, 'p');
    }

    function fetchEtherpad(id, success, error, secure, dir, exportPostfix) {
        var idParts = id.split('-');
        var host = idParts[1];
        var pad = idParts.slice(2).join('-');
        var webUrl = (secure ? 'https' : 'http') + '://' + host + '/' + (dir ? dir + '/' : '') + pad;
        var exportUrl = webUrl + (exportPostfix ? exportPostfix : '/export/txt');
        fetchFromUrl(exportUrl, success, error, {
            'sourceUrl': webUrl,
            'interXrefReplacer': function (element, href) {
                padInterXrefReplacer(idParts.slice(0, 2).join('-'), element, href);
            }
        });
    }

    function fetchGoogleDoc(id, success, error) {
        var baseUrl = GOOGLE_DOCS_BSE_URL + id.substr(5) + '/';
        var webUrl = baseUrl + 'edit';
        var url = baseUrl + 'export?format=txt';
        var options = {
            'sourceUrl': webUrl,
            'imageBaseLocation': false,
            'siteBaseLocation': false
        };
        fetchFromUrl(url, success, error, options);
    }

    function fetchFirepad(id, success, error) {
        var fetchId = id.slice(3);
        var headless = new Firepad.Headless(window.FIREBASE_URL + fetchId);
        headless.getText(function (text) {
            headless.dispose();
            success(text, {'editor': 'firepad'});
        });
    }

    function fetchAnyUrl(id, success, error) {
        fetchFromUrl(id, success, error, {
            'interXrefReplacer': function (element, href) {
                interXrefReplacer(id, element, href);
            },
            'includeReplacer': function (element, href) {
                includeReplacer(id, element, href);
            }
        });
    }

    function fetchFromUrl(url, success, error, opts) {
        var options = {
            'sourceUrl': url,
            'imageBaseLocation': removeDocumentNameFromUrl(url),
            'siteBaseLocation': getOrigin(url)
        };
        $.extend(options, opts);
        $.ajax({
            'url': url,
            'success': function (data) {
                success(data, options);
            },
            'dataType': 'text',
            'error': function (xhr, status, errorMessage) {
                error(errorMessage);
            }
        });
    }

    function includeReplacer(id, element, href) {
        if (includeFilter(href) && $(element).hasClass('bare')) {
            var base = removeDocumentNameFromUrl(id) + '/';
            var document = './?' + encodeURIComponent(base + href);
            element.setAttribute('href', document);
        }
    }

    function includeFilter(href) {
        if (href.charAt(0) === '/' || href.slice(0, 7) === 'http://' || href.slice(0, 8) === 'https://') {
            return false;
        }
        var ext = href.split('.').pop();
        return $.inArray(ext, ['asciidoc', 'adoc', 'ad', 'txt']) !== -1;
    }

    function interXrefReplacer(id, element, href) {
        if (interdocumentXrefFilter(href)) {
            var parts = href.split('#');
            var base = removeDocumentNameFromUrl(id) + '/';
            var filenameWithoutHtmlExtension = parts[0].substr(0, parts[0].length - 4);
            var document = './?' + encodeURIComponent(base + filenameWithoutHtmlExtension + getExtension(id)) + '#' + parts[1];
            element.setAttribute('href', document);
        }
    }

    function padInterXrefReplacer(padName, element, href) {
        if (interdocumentXrefFilter(href)) {
            var parts = href.split('#');
            var filenameWithoutHtmlExtension = parts[0].substr(0, parts[0].length - 5);
            var document = './?' + encodeURIComponent(padName + '-' + filenameWithoutHtmlExtension) + '#' + parts[1];
            element.setAttribute('href', document);
        }
    }

    function interdocumentXrefFilter(href) {
        return (href.indexOf('#') > 0 && './?'.indexOf(href.charAt(0)) === -1 && href.indexOf('http://') === -1 && href.indexOf('https://') === -1);
    }

    function getExtension(url) {
        return url.split('.').pop();
    }

    function removeDocumentNameFromUrl(url) {
        var pos = url.lastIndexOf('/');
        return url.substr(0, pos);
    }

    function getOrigin(url) {
        var link = document.createElement('a');
        link.setAttribute('href', url);
        return link.origin;
    }

    function errorMessage(message, gist) {
        var messageText;
        if (gist) {
            messageText = 'Something went wrong fetching the DocGist "' + gist + '":<p>' + message + '</p>';
        }
        else {
            messageText = '<p>' + message + '</p>';
        }

        $(document).ready(function () {
            $('#content').html('<div class="alert alert-danger"><h4>Error</h4>' + messageText + '</div>');
        });
    }
}
