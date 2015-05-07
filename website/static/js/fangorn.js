/**
 * Fangorn: Defining Treebeard options for OSF.
 * For Treebeard and _item API's check: https://github.com/caneruguz/treebeard/wiki
 */

'use strict';

var $ = require('jquery');
var m = require('mithril');
var URI = require('URIjs');
var Treebeard = require('treebeard');

var $osf = require('js/osfHelpers');
var waterbutler = require('js/waterbutler');

// CSS
require('css/fangorn.css');

var tbOptions;

var tempCounter = 1;

var EXTENSIONS = ['3gp', '7z', 'ace', 'ai', 'aif', 'aiff', 'amr', 'asf', 'asx', 'bat', 'bin', 'bmp', 'bup',
    'cab', 'cbr', 'cda', 'cdl', 'cdr', 'chm', 'dat', 'divx', 'dll', 'dmg', 'doc', 'docx', 'dss', 'dvf', 'dwg',
    'eml', 'eps', 'exe', 'fla', 'flv', 'gif', 'gz', 'hqx', 'htm', 'html', 'ifo', 'indd', 'iso', 'jar',
    'jpeg', 'jpg', 'lnk', 'log', 'm4a', 'm4b', 'm4p', 'm4v', 'mcd', 'md', 'mdb', 'mid', 'mov', 'mp2', 'mp3', 'mp4',
    'mpeg', 'mpg', 'msi', 'mswmm', 'ogg', 'pdf', 'png', 'pps', 'ps', 'psd', 'pst', 'ptb', 'pub', 'qbb',
    'qbw', 'qxd', 'ram', 'rar', 'rm', 'rmvb', 'rtf', 'sea', 'ses', 'sit', 'sitx', 'ss', 'swf', 'tgz', 'thm',
    'tif', 'tmp', 'torrent', 'ttf', 'txt', 'vcd', 'vob', 'wav', 'wma', 'wmv', 'wps', 'xls', 'xpi', 'zip',
    'xlsx', 'py'];

var EXTENSION_MAP = {};
EXTENSIONS.forEach(function(extension) {
    EXTENSION_MAP[extension] = extension;
});
$.extend(EXTENSION_MAP, {
    gdoc: 'docx',
    gsheet: 'xlsx'
});

var _defaultIconState = function () {
    return {
        mode : 'bar',
        generalIcons : {
            search : { on : true, template : searchIcon },
            info : { on : true, template : infoIcon },
            cancelUploads : { on : false, template : cancelUploadsIcon },
            deleteMultiple : { on : false, template :  deleteMultipleIcon }
        },
        rowIcons : [{}]

    };
};

// Cross browser key codes for the Command key
var commandKeys = [224, 17, 91, 93];

var ICON_PATH = '/static/img/hgrid/fatcowicons/';

var getExtensionIconClass = function(name) {
    var extension = name.split('.').pop().toLowerCase();
    var icon = EXTENSION_MAP[extension];
    if (icon) {
        return '_' + icon;
    }
    return null;
};

function findByTempID(parent, tmpID){
    var child;
    var item;
    for (var i = 0; i < parent.children.length; i++) {
        child = parent.children[i];
        if (!child.data.tmpID) {
            continue;
        }
        if (child.data.tmpID === tmpID) {
            item = child;
        }
    }
    return item;
}

function cancelUploads (row) {
    var tb = this;
    var filesArr = tb.dropzone.getQueuedFiles();
    for (var i = 0; i < filesArr.length; i++) {
        var j = filesArr[i];
        if(!row){
            var parent = j.treebeardParent || tb.dropzoneItemCache;
            var item = findByTempID(parent, j.tmpID);
            tb.dropzone.removeFile(j);
            tb.deleteNode(parent.id,item.id);
        } else {
            tb.deleteNode(row.parentID,row.id);
            if(row.data.tmpID === j.tmpID){
                tb.dropzone.removeFile(j);
            }
        }
    }
    tb.options.iconState.generalIcons.cancelUploads.on = false;
}

var cancelUploadTemplate = function(row){
    var treebeard = this;
    return m('.btn.m-l-sm.text-muted', {
            'onclick' : function (e) {
                cancelUploads.call(treebeard, row);
            }},
        m('.fa.fa-times-circle.text-danger', { style : 'display:block;font-size:18px'}));
};


// var cancelAllUploadsTemplate = function(){
//     var treebeard = this;
//     return m('div', [
//         m('span', 'Uploads in progress'),
//         m('.btn.btn-xs.m-l-sm.btn-danger', {
//             'onclick' : function() {
//                 cancelUploads.call(treebeard);
//             }
//         }, 'Cancel All Uploads')
//     ]);
// }


/**
 * Returns custom icons for OSF depending on the type of item
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {Object}  Returns a mithril template with the m() function.
 * @private
 */
function _fangornResolveIcon(item) {
    var privateFolder =  m('div.file-extension._folder_delete', ' '),
        pointerFolder = m('i.fa.fa-link', ' '),
        openFolder  = m('i.fa.fa-folder-open', ' '),
        closedFolder = m('i.fa.fa-folder', ' '),
        configOption = item.data.provider ? resolveconfigOption.call(this, item, 'folderIcon', [item]) : undefined,  // jshint ignore:line
        icon;

    if (item.kind === 'folder') {
        if (item.data.iconUrl) {
            return m('img', {src: item.data.iconUrl, style: {width: '16px', height: 'auto'}});
        }
        if (!item.data.permissions.view) {
            return privateFolder;
        }
        if (item.data.isPointer) {
            return pointerFolder;
        }
        if (item.open) {
            return configOption || openFolder;
        }
        return configOption || closedFolder;
    }
    if (item.data.icon) {
        return m('i.fa.' + item.data.icon, ' ');
    }

    icon = getExtensionIconClass(item.data.name);
    if (icon) {
        return m('div.file-extension', { 'class': icon });
    }
    return m('i.fa.fa-file-text-o');
}

// Addon config registry. this will be populated with add on specific items if any.
Fangorn.config = {};

/**
 * Returns add on specific configurations
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @param {String} key What the option is called in the add on object
 * @this Treebeard.controller
 * @returns {*} Returns the configuration, can be string, number, array, or function;
 */
function getconfig(item, key) {
    if (item && item.data.provider && Fangorn.config[item.data.provider]) {
        return Fangorn.config[item.data.provider][key];
    }
    return undefined;
}

/**
 * Gets a Fangorn config option if it is defined by an addon dev.
 * Calls it with `args` if it's a function otherwise returns the value.
 * If the config option is not defined, returns null
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @param {String} option What the option is called in the add on object
 * @param {Array} args An Array of whatever arguments will be sent with the .apply()
 * @this Treebeard.controller
 * @returns {*} Returns if its a property, runs the function if function, returns null if no option is defined.
 */
function resolveconfigOption(item, option, args) {
    var self = this,  // jshint ignore:line
        prop = getconfig(item, option);
    if (prop) {
        return typeof prop === 'function' ? prop.apply(self, args) : prop;
    }
    return null;
}

/**
 * Inherits a list of data fields from one item (parent) to another.
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @param {Object} parent A Treebeard _item object. Node information is inside item.data
 * @this Treebeard.controller
 */
var inheritedFields = ['nodeId', 'nodeUrl', 'nodeApiUrl', 'permissions', 'provider', 'accept'];
function inheritFromParent(item, parent, fields) {
    fields = fields || inheritedFields;
    fields.forEach(function(field) {
        item.data[field] = item.data[field] || parent.data[field];
    });
}

/**
 * Returns custom folder toggle icons for OSF
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {string} Returns a mithril template with m() function, or empty string.
 * @private
 */
function _fangornResolveToggle(item) {
    var toggleMinus = m('i.fa.fa-minus', ' '),
        togglePlus = m('i.fa.fa-plus', ' ');
    // check if folder has children whether it's lazyloaded or not.
    if (item.kind === 'folder' && item.depth > 1) {
        if(!item.data.permissions.view){
            return '';
        }
        if (item.open) {
            return toggleMinus;
        }
        return togglePlus;
    }
    return '';
}

/**
 * Checks if folder toggle is permitted (i.e. contents are private)
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {boolean}
 * @private
 */
function _fangornToggleCheck(item) {

    if (item.data.permissions.view) {
        return true;
    }
    item.notify.update('Not allowed: Private folder', 'warning', 1, undefined);
    return false;
}

/**
 * Find out what the upload URL is for each item
 * Because we use add ons each item will have something different. This needs to be in the json data.
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {String} Returns the url string from data or resolved through add on settings.
 * @private
 */
function _fangornResolveUploadUrl(item, file) {
    var configOption = resolveconfigOption.call(this, item, 'uploadUrl', [item, file]); // jshint ignore:line
    return configOption || waterbutler.buildTreeBeardUpload(item, file);
}

/**
 * Event to fire when mouse is hovering over row. Currently used for hover effect.
 * @param {Object} item A Treebeard _item object. Node information is inside item.data
 * @param event The mouseover event from the browser
 * @this Treebeard.controller
 * @private
 */
function _fangornMouseOverRow(item, event) {
    $('.fg-hover-hide').hide();
    $(event.target).closest('.tb-row').find('.fg-hover-hide').show();
}

/**
 * Runs when dropzone uploadprogress is running, used for updating upload progress in view and models.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @param {Number} progress Progress number between 0 and 100
 * @this Dropzone
 * @private
 */
function _fangornUploadProgress(treebeard, file, progress) {
    var parent = file.treebeardParent;

    var item,
        child,
        templateWithCancel;

    for(var i = 0; i < parent.children.length; i++) {
        child = parent.children[i];
        if(!child.data.tmpID){
            continue;
        }
        if(child.data.tmpID === file.tmpID) {
            item = child;
        }
    }

    templateWithCancel = m('span', [
        m('span', file.name.slice(0,25) + '... : ' + 'Uploaded ' + Math.floor(progress) + '%'),
        cancelUploadTemplate.call(treebeard, item)
    ]);


    if (progress < 100) {
        item.notify.update(templateWithCancel, 'success', null, 0);
    } else {
        item.notify.update(templateWithCancel, 'success', null, 2000);
    }
}

/**
 * Runs when dropzone sending method is running, used for updating the view while file is being sent.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @param xhr xhr information being sent
 * @param formData Dropzone's formdata information
 * @this Dropzone
 * @returns {*|null} Return isn't really used here by anything else.
 * @private
 */
function _fangornSending(treebeard, file, xhr, formData) {
    treebeard.options.uploadInProgress = true;
    var parent = file.treebeardParent || treebeard.dropzoneItemCache;
    var _send = xhr.send;
    xhr.send = function() {
        _send.call(xhr, file);
    };
    var filesArr = treebeard.dropzone.getQueuedFiles();
    if (filesArr.length  > 0) {
        treebeard.options.iconState.generalIcons.cancelUploads.on = true;
    } else {
        treebeard.options.iconState.generalIcons.cancelUploads.on = false;
    }
    var configOption = resolveconfigOption.call(treebeard, parent, 'uploadSending', [file, xhr, formData]);
    return configOption || null;
}

/**
 * Runs when Dropzone's addedfile hook is run.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @this Dropzone
 * @returns {*|null}
 * @private
 */
function _fangornAddedFile(treebeard, file) {
    var item = file.treebeardParent;
    if (!_fangornCanDrop(treebeard, item)) {
        return;
    }
    var configOption = resolveconfigOption.call(treebeard, item, 'uploadAdd', [file, item]);

    var tmpID = tempCounter++;

    file.tmpID = tmpID;
    file.url = _fangornResolveUploadUrl(item, file);
    file.method = _fangornUploadMethod(item);

    var blankItem = {       // create a blank item that will refill when upload is finished.
        name: file.name,
        kind: 'file',
        provider: item.data.provider,
        children: [],
        permissions: {
            view: false,
            edit: false
        },
        tmpID: tmpID
    };
    var newitem = treebeard.createItem(blankItem, item.id);
    return configOption || null;
}

function _fangornCanDrop(treebeard, item) {
    var canDrop = resolveconfigOption.call(treebeard, item, 'canDrop', [item]);
    if (canDrop === null) {
        canDrop = item.data.provider && item.kind === 'folder' && item.data.permissions.edit;
    }
    return canDrop;
}

/**
 * Runs when Dropzone's dragover event hook is run.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param event DOM event object
 * @this Dropzone
 * @private
 */
function _fangornDragOver(treebeard, event) {
    var dropzoneHoverClass = 'fangorn-dz-hover',
        closestTarget = $(event.target).closest('.tb-row'),
        itemID = parseInt(closestTarget.attr('data-id')),
        item = treebeard.find(itemID);
    treebeard.select('.tb-row').removeClass(dropzoneHoverClass).removeClass(treebeard.options.hoverClass);
    if (item !== undefined) {
        if (_fangornCanDrop(treebeard, item)) {
            closestTarget.addClass(dropzoneHoverClass);
        }
    }
}

/**
 * Runs when Dropzone's drop event hook is run.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param event DOM event object
 * @this Dropzone
 * @private
 */
function _fangornDropzoneDrop(treebeard, event) {
    var dropzoneHoverClass = 'fangorn-dz-hover';
    treebeard.select('.tb-row').removeClass(dropzoneHoverClass);
}
/**
 * Runs when Dropzone's complete hook is run after upload is completed.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @this Dropzone
 * @private
 */
function _fangornComplete(treebeard, file) {
    var item = file.treebeardParent;
    resolveconfigOption.call(treebeard, item, 'onUploadComplete', [item]);
    _fangornOrderFolder.call(treebeard, item);
}

/**
 * Runs when Dropzone's success hook is run.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @param {Object} response JSON response from the server
 * @this Dropzone
 * @private
 */
function _fangornDropzoneSuccess(treebeard, file, response) {
    treebeard.options.uploadInProgress = false;
    var parent = file.treebeardParent,
        item,
        revisedItem,
        child;
    for (var i = 0; i < parent.children.length; i++) {
        child = parent.children[i];
        if (!child.data.tmpID){
            continue;
        }
        if (child.data.tmpID === file.tmpID) {
            item = child;
        }
    }
    // RESPONSES
    // OSF : Object with actionTake : "file_added"
    // DROPBOX : Object; addon : 'dropbox'
    // S3 : Nothing
    // GITHUB : Object; addon : 'github'
    // Dataverse : Object, actionTaken : file_uploaded
    revisedItem = resolveconfigOption.call(treebeard, item.parent(), 'uploadSuccess', [file, item, response]);
    if (!revisedItem && response) {
        item.data = response;
        inheritFromParent(item, item.parent());
    }
    if (item.data.tmpID) {
        item.data.tmpID = null;
    }
    // Remove duplicates if file was updated
    var status = file.xhr.status;
    if (status === 200) {
        parent.children.forEach(function(child) {
            if (child.data.name === item.data.name && child.id !== item.id) {
                child.removeSelf();
            }
        });
    }
    treebeard.redraw();
}

/**
 * runs when Dropzone's error hook runs. Notifies user with error.
 * @param {Object} treebeard The treebeard instance currently being run, check Treebeard API
 * @param {Object} file File object that dropzone passes
 * @param message Error message returned
 * @private
 */
var DEFAULT_ERROR_MESSAGE = 'Could not upload file. The file may be invalid ' +
    'or the file folder has been deleted.';
function _fangornDropzoneError(treebeard, file, message) {
    // File may either be a webkit Entry or a file object, depending on the browser
    // On Chrome we can check if a directory is being uploaded
    var msgText;
    if (file.isDirectory) {
        msgText = 'Cannot upload directories, applications, or packages.';
    } else {
        msgText = DEFAULT_ERROR_MESSAGE;
    }
    var parent = file.treebeardParent || tb.dropzoneItemCache;
    // Parent may be undefined, e.g. in Chrome, where file is an entry object
    var item;
    var child;
    var destroyItem = false;
    for (var i = 0; i < parent.children.length; i++) {
        child = parent.children[i];
        if (!child.data.tmpID) {
            continue;
        }
        if (child.data.tmpID === file.tmpID) {
            item = child;
            tb.deleteNode(parent.id, item.id);
        }
    }
    $osf.growl('Error', msgText);
    tb.options.uploadInProgress = false;
}

/**
 * Click event for when upload buttonin Action Column, it essentially runs the hiddenFileInput.click
 * @param event DOM event object for click
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} col Information pertinent to that column where this upload event is run from
 * @private
 */
function _uploadEvent(event, item, col) {
    var self = this;  // jshint ignore:line
    try {
        event.stopPropagation();
    } catch (e) {
        window.event.cancelBubble = true;
    }
    self.dropzoneItemCache = item;
    self.dropzone.hiddenFileInput.click();
    if (!item.open) {
        self.updateFolder(null, item);
    }
}

/**
 * Download button in Action Column
 * @param event DOM event object for click
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} col Information pertinent to that column where this upload event is run from
 * @private
 */
function _downloadEvent (event, item, col) {
    try {
        event.stopPropagation();
    } catch (e) {
        window.event.cancelBubble = true;
    }
    window.location = waterbutler.buildTreeBeardDownload(item);
}

function _createFolder(event) {
    var tb = this;
    var val = $.trim(tb.select('#createFolderInput').val());
    var parent = tb.multiselected[0];
    if (!parent.open) {
         tb.updateFolder(null, parent);
    }

    // event.preventDefault();
    if (val.length < 1) {
        tb.select('#createFolderError').text('Please enter a folder name.').show();
        return;
    }
    if (val.indexOf('/') !== -1) {
        tb.select('#createFolderError').text('Folder name contains illegal characters.').show();
        return;
    }

    var path = (parent.data.path || '/') + val + '/';

    m.request({
        method: 'POST',
        background: true,
        url: waterbutler.buildCreateFolderUrl(path, parent.data.provider, parent.data.nodeId)
    }).then(function(item) {
        inheritFromParent({data: item}, parent);
        item = tb.createItem(item, parent.id);
        _fangornOrderFolder.call(tb, parent);
        item.notify.update('New folder created!', 'success', undefined, 1000);
        tb.options.iconState.mode = 'bar';
        tb.select('#createFolderError').text('').hide();
    }, function(data) {
        if (data && data.code === 409) {
            tb.select('#createFolderError').text(data.message).show();
        } else {
            tb.select('#createFolderError').text('Folder creation failed.').show();
        }
    });
}

/**
 * Deletes the item, only appears for items
 * @param event DOM event object for click
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} col Information pertinent to that column where this upload event is run from
 * @private
 */

function _removeEvent (event, items, col) {
    var tb = this;
    function cancelDelete() {
        tb.modal.dismiss();
    }
    function runDelete(item) {
        tb.select('.tb-modal-footer .text-danger').html('<i> Deleting...</i>').css('color', 'grey');
        // delete from server, if successful delete from view
        var url = resolveconfigOption.call(this, item, 'resolveDeleteUrl', [item]);
        url = url || waterbutler.buildTreeBeardDelete(item);
        $.ajax({
            url: url,
            type: 'DELETE'
        })
        .done(function(data) {
            // delete view
            tb.deleteNode(item.parentID, item.id);
            tb.modal.dismiss();
            _fangornResetToolbar.call(tb);
        })
        .fail(function(data){
            tb.modal.dismiss();
            _fangornResetToolbar.call(tb);
            item.notify.update('Delete failed.', 'danger', undefined, 3000);
        });
    }
    function runDeleteMultiple(items){
        items.forEach(function(item){
            runDelete(item);
        });
        this.options.iconState.generalIcons.deleteMultiple.on = false;
    }

    function doDelete() {
        var folder = items[0];
        if (folder.data.permissions.edit) {
                var mithrilContent = m('div', [
                        m('h3.break-word', 'Delete "' + folder.data.name+ '"?'),
                        m('p', 'This action is irreversible.')
                    ]);
                var mithrilButtons = m('div', [
                        m('span.tb-modal-btn', { 'class' : 'text-primary', onclick : function() { cancelDelete.call(tb); } }, 'Cancel'),
                        m('span.tb-modal-btn', { 'class' : 'text-danger', onclick : function() { runDelete(folder); }  }, 'Delete')
                    ]);
                tb.modal.update(mithrilContent, mithrilButtons);
        } else {
            folder.notify.update('You don\'t have permission to delete this file.', 'info', undefined, 3000);
        }
    }

    // If there is only one item being deleted, don't complicate the issue:
    if(items.length === 1) {
        if(items[0].kind !== 'folder'){
            var mithrilContentSingle = m('div', [
                m('h3.break-word', 'Delete "' + items[0].data.name + '"'),
                m('p', 'This action is irreversible.')
            ]);
            var mithrilButtonsSingle = m('div', [
                m('span.tb-modal-btn', { 'class' : 'text-primary', onclick : function() { cancelDelete(); } }, 'Cancel'),
                m('span.tb-modal-btn', { 'class' : 'text-danger', onclick : function() { runDelete(items[0]); }  }, 'Delete')
            ]);
            // This is already being checked before this step but will keep this edit permission check
            if(items[0].data.permissions.edit){
                tb.modal.update(mithrilContentSingle, mithrilButtonsSingle);
            }
        }
        if(items[0].kind === 'folder') {
            if (!items[0].open) {
                tb.updateFolder(null, items[0], doDelete);
            } else {
                doDelete();
            }
        }
    } else {
        // Check if all items can be deleted
        var canDelete = true;
        var deleteList = [];
        var noDeleteList = [];
        var deleteMessage = [m('p', 'This action is irreversible.')];
        var mithrilContentMultiple;
        var mithrilButtonsMultiple;
        items.forEach(function(item, index, arr){
            if(!item.data.permissions.edit){
                canDelete = false;
                noDeleteList.push(item);
            } else {
                deleteList.push(item);
            }
            if(item.kind === 'folder' && deleteMessage.length === 1) {
                deleteMessage.push(m('p', 'Some items in this list are folders. This will delete all their content.'))
            }
        });
        // If all items can be deleted
        if(canDelete){
            mithrilContentMultiple = m('div', [
                    m('h3.break-word', 'Delete multiple files?'),
                    deleteMessage,
                    deleteList.map(function(n){
                        if(n.kind === 'folder'){
                            return m('.fangorn-canDelete.text-success.break-word', [
                                m('i.fa.fa-folder'),m('b', ' ' + n.data.name)
                                ]);
                        }
                        return m('.fangorn-canDelete.text-success.break-word', n.data.name);
                    })
                ]);
            mithrilButtonsMultiple =  m('div', [
                    m('span.tb-modal-btn', { 'class' : 'text-primary', onclick : function() { tb.modal.dismiss(); } }, 'Cancel'),
                    m('span.tb-modal-btn', { 'class' : 'text-danger', onclick : function() { runDeleteMultiple.call(tb, deleteList); }  }, 'Delete All')
                ]);
        } else {
            mithrilContentMultiple = m('div', [
                    m('h3.break-word', 'Delete multiple files?'),
                    m('p', 'Some of these files can\'t be deleted but you can delete the ones highlighted with green. This action is irreversible.'),
                    deleteList.map(function(n){
                        if(n.kind === 'folder'){
                            return m('.fangorn-canDelete.text-success.break-word', [
                                m('i.fa.fa-folder'),m('b', ' ' + n.data.name)
                                ]);
                        }
                        return m('.fangorn-canDelete.text-success.break-word', n.data.name);
                    }),
                    noDeleteList.map(function(n){
                        return m('.fangorn-noDelete.text-warning.break-word', n.data.name);
                    })
                ]);
            mithrilButtonsMultiple =  m('div', [
                    m('span.tb-modal-btn', { 'class' : 'text-primary', onclick : function() {  tb.modal.dismiss(); } }, 'Cancel'),
                    m('span.tb-modal-btn', { 'class' : 'text-danger', onclick : function() { runDeleteMultiple.call(tb, deleteList); }  }, 'Delete Some')
                ]);
        }
        tb.modal.update(mithrilContentMultiple, mithrilButtonsMultiple);
    }


}

/**
 * Resolves lazy load url for fetching children
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {String|Boolean} Returns the fetch URL in string or false if there is no url.
 * @private
 */
function _fangornResolveLazyLoad(item) {
    var configOption = resolveconfigOption.call(this, item, 'lazyload', [item]);
    if (configOption) {
        return configOption;
    }

    if (item.data.provider === undefined) {
        return false;
    }
    return waterbutler.buildTreeBeardMetadata(item);
}

/**
 * Checks if the file being uploaded exists by comparing name of existing children with file name
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} file File object that dropzone passes
 * @this Treebeard.controller
 * @returns {boolean}
 * @private
 */
// function _fangornFileExists(item, file) {
//     var i,
//         child;
//     for (i = 0; i < item.children.length; i++) {
//         child = item.children[i];
//         if (child.kind === 'file' && child.data.name === file.name) {
//             return true;
//         }
//     }
//     return false;
// }

/**
 * Handles errors in lazyload fetching of items, usually link is wrong
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @private
 */
function _fangornLazyLoadError (item) {
    var configOption = resolveconfigOption.call(this, item, 'lazyLoadError', [item]);
    if (!configOption) {
        item.notify.update('Files couldn\'t load, please try again later.', 'deleting', undefined, 3000);
    }
}

/**
 * Applies the positionining and initialization of tooltips for file names
 * @private
 */
function reapplyTooltips () {
    $('[data-toggle="tooltip"]').tooltip({container: 'body', 'animation' : false});
}

/**
 * Called when new object data has arrived to be loaded.
 * @param {Object} tree A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @private
 */
function _fangornLazyLoadOnLoad (tree, event) {
    tree.children.forEach(function(item) {
        inheritFromParent(item, tree);
    });
    resolveconfigOption.call(this, tree, 'lazyLoadOnLoad', [tree, event]);
    reapplyTooltips();

    if (tree.depth > 1) {
        _fangornOrderFolder.call(this, tree);
    }
}

/**
 * Order contents of a folder without an entire sorting of all the table
 * @param {Object} tree A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @private
 */
function _fangornOrderFolder(tree) {
    // Checking if this column does in fact have sorting
    if (this.isSorted[0]) {
        var sortDirection = this.isSorted[0].desc ? 'desc' : 'asc';
        tree.sortChildren(this, sortDirection, 'text', 0);
        this.redraw();
    }
}

/**
 * Changes the upload method based on what the add ons need. Default is POST, S3 needs PUT
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {string} Must return string that is a legitimate method like POST, PUT
 * @private
 */
function _fangornUploadMethod(item) {
    var configOption = resolveconfigOption.call(this, item, 'uploadMethod', [item]);
    return configOption || 'PUT';
}


/**
 * Defines the contents for the action column, upload and download buttons etc.
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} col Options for this particulat column
 * @this Treebeard.controller
 * @returns {Array} Returns an array of mithril template objects using m()
 * @private
 */
function _fangornDefineToolbar (item) {
    var tb = this,
        buttons = [];
    $('.fangorn-toolbar-icon').tooltip('destroy');

    // Upload button if this is a folder
    // If File and FileRead are not defined dropzone is not supported and neither is uploads
    if (window.File && window.FileReader && item.kind === 'folder' && item.data.provider && item.data.permissions && item.data.permissions.edit) {
        buttons.push({ name : 'uploadFiles', template : function(){
            return m('.fangorn-toolbar-icon.text-success', {
                    'data-toggle' : 'tooltip',
                    'title':  'Select files to upload from your computer.',
                    'data-placement' : 'bottom',
                    onclick : function(event) { _uploadEvent.call(tb, event, item); }
                },[
                m('i.fa.fa-upload'),
                m('span.hidden-xs','Upload')
            ]);
        }},
        { name : 'createFolder', template : function(){
                return m('.fangorn-toolbar-icon.text-info', {
                    'data-toggle' : 'tooltip',
                    'title':  'Create a new folder inside curently selected folder.',
                    'data-placement' : 'bottom',
                        onclick : function(event) {
                            tb.options.iconState.mode = 'createFolder';
                            m.redraw(true);
                        }
                    },[
                    m('span.osf-fa-stack', [ m('i.fa.fa-folder.osf-fa-stack-bottom.fa-stack-1x'),m('i.fa.fa-plus.fa-stack-1x.osf-fa-stack-top.text-white')]),
                    m('span.hidden-xs','Create Folder')
                ]);
            }},
            { name : 'downloadZip', template : function(){
                return m('.fangorn-toolbar-icon.text-info', {
                    'data-toggle' : 'tooltip',
                    'title':  'Download Folder contents as a zip file',
                    'data-placement' : 'bottom',
                    onclick : function(event) {
                        _downloadZipEvent.call(tb, item);
                    }
                },[
                    m('i.fa.fa-file-archive-o'),
                    m('span.hidden-xs','Download Folder')
                ]);
            }}
        );
        if(item.data.path) {
            buttons.push({ name : 'deleteFolder', template : function(){
                return m('.fangorn-toolbar-icon.text-danger', {
                    'data-toggle' : 'tooltip',
                    'title':  'Delete this folder and all its contents.',
                    'data-placement' : 'bottom',
                        onclick : function(event) { _removeEvent.call(tb, event, [item]); }
                    },[
                    m('i.fa.fa-trash'),
                    m('span.hidden-xs','Delete Folder')
                ]);
            }});
        }
    }
    //Download button if this is an item
    if (item.kind === 'file') {
        buttons.push({ name : 'downloadSingle', template : function(){
            return m('.fangorn-toolbar-icon.text-primary', {
                    'data-toggle' : 'tooltip',
                    'title':  'Download this file to your computer.',
                    'data-placement' : 'bottom',
                    onclick : function(event) { _downloadEvent.call(tb, event, [item]); }
                }, [
                m('i.fa.fa-download'),
                m('span.hidden-xs','Download')
            ]);
        }});
        if (item.data.permissions && item.data.permissions.edit) {
            buttons.push({ name : 'deleteSingle', template : function(){
                return m('.fangorn-toolbar-icon.text-danger', {
                    'data-toggle' : 'tooltip',
                    'title':  'Permanently delete this file.',
                    'data-placement' : 'bottom',
                        onclick : function(event) { _removeEvent.call(tb, event, [item]); }
                    }, [
                    m('i.fa.fa-times'),
                    m('span.hidden-xs','Delete')
                ]);
            }});
        }
    }
    // Coming in a future implementation
    // if(item.data.provider && !item.data.isAddonRoot && item.data.permissions && item.data.permissions.edit) {
    //     buttons.push(
    //         { name : 'renameItem', template : function(){
    //         return m('.fangorn-toolbar-icon.text-primary', {
    //                 'data-toggle' : 'tooltip',
    //                 'title':  'Change the name of the Collection or project',
    //                 'data-placement' : 'bottom',
    //                 onclick : function(event) {
    //                     tb.options.iconState.mode = 'rename';
    //                 }
    //             }, [
    //             m('i.fa.fa-font'),
    //             m('span','Rename')
    //         ]);
    //     }});
    // }

    item.icons = buttons;
    $('.fangorn-toolbar-icon').tooltip();
}

/**
 * Defines the contents of the title column (does not include the toggle and folder sections
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @param {Object} col Options for this particulat column
 * @this Treebeard.controller
 * @returns {Array} Returns an array of mithril template objects using m()
 * @private
 */
function _fangornTitleColumn(item, col) {
    var tb = this;
    if (item.kind === 'file' && item.data.permissions.view) {
        return m('span',{
            ondblclick: function() {
                var redir = new URI(item.data.nodeUrl);
                redir.segment('files').segment(item.data.provider).segmentCoded(item.data.path.substring(1));
                var fileurl  = redir.toString() + '/';
                if(commandKeys.indexOf(tb.pressedKey) !== -1) {
                    window.open(fileurl, '_blank');
                } else {
                    window.open(fileurl, '_self');
                }
            },
        }, item.data.name);
    }
    return m('span', item.data.name);
}

/**
 * Parent function for resolving rows, all columns are sub methods within this function
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @returns {Array} An array of columns that get iterated through in Treebeard
 * @private
 */
function _fangornResolveRows(item) {
    var default_columns = [];
    var configOption;
    item.css = '';
    if(this.isMultiselected(item.id)){
        item.css = 'fangorn-selected';
    }

    // define the toolbar icons for this item
    configOption = resolveconfigOption.call(this, item, 'defineToolbar', [item]);
    if (!configOption){
        _fangornDefineToolbar.call(this, item);
    }

    if(item.data.tmpID){
        return [
        {
            data : '',  // Data field name
            css : 't-a-c',
            custom : function(){ return m('span.text-muted', [m('span', ' Uploading:' + item.data.name), m('span', cancelUploadTemplate.call(this, item))]); }
        },
        {
            data : '',  // Data field name
            custom : function(){ return '';}
        }
        ];
    }

    if (item.parentID) {
        item.data.permissions = item.data.permissions || item.parent().data.permissions;
        if (item.data.kind === 'folder') {
            item.data.accept = item.data.accept || item.parent().data.accept;
        }
    }
    default_columns.push(
    {
        data : 'name',  // Data field name
        folderIcons : true,
        filter : true,
        custom : _fangornTitleColumn
    });
    if (item.data.provider === 'osfstorage' && item.data.kind === 'file') {
        default_columns.push({
            data : 'downloads',
            sortInclude : false,
            filter : false,
            custom: function() { return item.data.extra ? item.data.extra.downloads.toString() : ''; }
        });
    } else {
        default_columns.push({
            data : 'downloads',
            sortInclude : false,
            filter : false,
            custom : function() { return m(''); }
        });
    }
    configOption = resolveconfigOption.call(this, item, 'resolveRows', [item]);
    return configOption || default_columns;
}

/**
 * Defines Column Titles separately since content and css may be different, allows more flexibility
 * @returns {Array} an Array of column information that gets templated inside Treebeard
 * @this Treebeard.controller
 * @private
 */
function _fangornColumnTitles () {
    var columns = [];
    columns.push(
    {
        title: 'Name',
        width : '90%',
        sort : true,
        sortType : 'text'
    }, {
        title : 'Downloads',
        width : '10%',
        sort : false
    });
    return columns;
}

/**
 * When fangorn loads the top level needs to be open so we load the children on load
 * @this Treebeard.controller
 * @private
 */
function _loadTopLevelChildren() {
    var i;
    for (i = 0; i < this.treeData.children.length; i++) {
        this.updateFolder(null, this.treeData.children[i]);
    }
}

/**
 * Expand major addons on load
 * @param {Object} item A Treebeard _item object for the row involved. Node information is inside item.data
 * @this Treebeard.controller
 * @private
 */
function expandStateLoad(item) {
    var tb = this,
        i;
    if (item.children.length > 0 && item.depth === 1) {
        for (i = 0; i < item.children.length; i++) {
            // if (item.children[i].data.isAddonRoot || item.children[i].data.addonFullName === 'OSF Storage' ) {
                tb.updateFolder(null, item.children[i]);
            // }
        }
    }
    if (item.children.length > 0 && item.depth === 2) {
        for (i = 0; i < item.children.length; i++) {
            if (item.children[i].data.isAddonRoot || item.children[i].data.addonFullName === 'OSF Storage' ) {
                tb.updateFolder(null, item.children[i]);
            }
        }
    }
        $('.fangorn-toolbar-icon').tooltip();
}

/**
 * @param tree A Treebeard _item object for the row
 * @param nodeID Current node._id
 * @param file window.contextVars.file object
 */
function setCurrentFileID(tree, nodeID, file) {
    var tb = this;
    if (file.provider === 'figshare') {
        for (var i = 0; i < tree.children.length; i++) {
            var child = tree.children[i];
            if (nodeID === child.data.nodeId && child.data.provider === file.provider && child.data.path === file.path) {
                tb.currentFileID = child.id;
            }
        }
    } else if (file.provider === 'dataverse') {
        // Only highlight file in correct dataset version, since paths persist across versions
        for (var i = 0; i < tree.children.length; i++) {
            var child = tree.children[i];
            var urlParams = $osf.urlParams();
            if (nodeID === child.data.nodeId && child.data.provider === file.provider && child.data.path === file.path
                && child.data.extra.datasetVersion === urlParams.version) {
                tb.currentFileID = child.id;
            }
        }
    } else if (tb.fangornFolderIndex !== undefined && tb.fangornFolderArray !== undefined && tb.fangornFolderIndex < tb.fangornFolderArray.length) {
        for (var j = 0; j < tree.children.length; j++) {
            var child = tree.children[j];
            if (nodeID === child.data.nodeId && child.data.provider === file.provider && child.data.name === tb.fangornFolderArray[tb.fangornFolderIndex]) {
                tb.fangornFolderIndex++;
                if (child.data.kind === 'folder') {
                    tb.updateFolder(null, child);
                    tree = child;
                }
                else {
                    tb.currentFileID = child.id;
                }
            }
        }
    }
}

/**
 * Scroll to the Treebeard item corresponding to the given ID
 * @param fileID id of a Treebeard _item object
 */
function scrollToFile(fileID) {
    var tb = this;
    if (fileID !== undefined) {
        var index = tb.returnIndex(fileID);
        var visibleIndex = tb.visibleIndexes.indexOf(index);
        if (visibleIndex !== -1 && visibleIndex > tb.showRange.length - 2) {
            var scrollTo = visibleIndex * tb.options.rowHeight;
            this.select('#tb-tbody').scrollTop(scrollTo);
        }
    }
}

function _fangornToolbar () {
    var tb = this;
    var titleContent = tb.options.title();
    var generalButtons = [];
    var rowMessage = m('i.m-r-sm','Select rows for further actions.');
    var rowButtons = function(){
        if(tb.multiselected.length > 1) {
            return '';
        }
        return tb.options.iconState.rowIcons.map(function(icon){
            if(icon.template){
                return icon.template.call(tb);
            }
        });
    }
    var generalIcons = tb.options.iconState.generalIcons;
    if (generalIcons.deleteMultiple.on) {
        generalButtons.push(generalIcons.deleteMultiple.template.call(tb));
    }
    if (generalIcons.cancelUploads.on) {
        generalButtons.push(generalIcons.cancelUploads.template.call(tb));
    }
    if (generalIcons.search.on) {
        generalButtons.push(generalIcons.search.template.call(tb));
    }
    generalButtons.push(generalIcons.info.template.call(tb));
    if(tb.multiselected.length > 0){
        rowMessage = '';
    }
    if (tb.options.iconState.mode === 'bar'){
        return m('.row.tb-header-row', { 'data-mode' : 'bar'}, [
                m('.col-xs-12', [
                        rowMessage,
                        m('.fangorn-toolbar.pull-right',
                            [
                                rowButtons(),
                                generalButtons
                            ]
                        )
                    ])
            ]);
    }
    if(tb.options.iconState.mode === 'search'){
        return m('.row.tb-header-row', { 'data-mode' : 'search'},  [
            m('#searchRow', { config : function () { $('#searchRow input').focus(); }}, [
                        m('.col-xs-11',{ style : 'width: 90%'}, tb.options.filterTemplate.call(tb)),
                        m('.col-xs-1',
                            m('.fangorn-toolbar.pull-right',
                                toolbarDismissIcon.call(tb)
                            )
                        )
                    ])
            ]);
    }
    if(tb.options.iconState.mode === 'rename'){
        return m('.row.tb-header-row', [
            m('#renameRow', { config : function () { $('#renameRow input').focus(); }}, [
                        m('.col-xs-9', m('input#renameInput.tb-header-input', { value : tb.multiselected[0].data.name })),
                        m('.col-xs-3.tb-buttons-col',
                            m('.fangorn-toolbar.pull-right',
                                [
                                renameButton.call(tb),
                                toolbarDismissIcon.call(tb)
                                ]
                            )
                        )
                    ])
            ]);
    }
    if(tb.options.iconState.mode === 'createFolder'){
        return m('.row.tb-header-row', [
            m('#folderRow', { config : function () {
                $('#folderRow input').focus();
            }}, [
                        m('.col-xs-9', [
                            m('input#createFolderInput.tb-header-input', { placeholder : 'Folder name' }),
                            m('#createFolderError.text-danger', { style : "display: none"})
                            ]),
                        m('.col-xs-3.tb-buttons-col',
                            m('.fangorn-toolbar.pull-right',
                                [
                                createFolderButton.call(tb),
                                toolbarDismissIcon.call(tb)
                                ]
                            )
                        )
                    ])
            ]);
    }
}


function _fangornResetToolbar () {
    var tb = this;
    if (tb.options.iconState.mode === 'search') {
        tb.options.iconState = _defaultIconState();
    }
    tb.options.iconState.mode = 'bar';
    tb.resetFilter();
    m.redraw();
}

/**
 * Toolbar icon templates
 *
 */
function toolbarDismissIcon (){
    var tb = this;
    return m('.fangorn-toolbar-icon', {
            onclick : function () {
                _fangornResetToolbar.call(tb);
            }
        },
        m('i.fa.fa-times')
    );
}
 function searchIcon (){
    var tb = this;
    return m('.fangorn-toolbar-icon.text-info', {
            'data-toggle' : 'tooltip',
            'title':  'Switch to search view.',
            'data-placement' : 'bottom',
            onclick : function () {
                tb.options.iconState.mode = 'search';
                tb.filterText('');
                m.redraw(true);
                tb.clearMultiselect();
            }
        }, [
        m('i.fa.fa-search'),
        m('span.hidden-xs', 'Search')
    ]);
 }
  function infoIcon (){
    var tb = this;
    return m('.fangorn-toolbar-icon.text-info', {
            'data-toggle' : 'tooltip',
            'title':  'Learn more about how to use the file browser.',
            'data-placement' : 'bottom',
            onclick : function () {
                var mithrilContent = m('div', [
                        m('h3.break-word.m-b-lg', 'How to Use the File Browser'),
                        m('p', [ m('b', 'Select Multiple Files:'), m('span', ' Use command or shift keys to select multiple files.')]),
                        m('p', [ m('b', 'Open Files:'), m('span', ' Double click a file name to go to the file.')]),
                        m('p', [ m('b', 'Open Files in New Tab:'), m('span',  ' Press Command (or Ctrl in Windows) and click a file name to open it in a new tab.')]),
                    ]);
                var mithrilButtons = m('div', [
                        m('span.tb-modal-btn', { 'class' : 'text-primary', onclick : function() { tb.modal.dismiss(); } }, 'Close'),
                    ]);
                tb.modal.update(mithrilContent, mithrilButtons);

            }
        }, [
        m('i.fa.fa-info')
    ]);
 }
 function cancelUploadsIcon (){
    var tb = this;
    return m('.fangorn-toolbar-icon.text-warning', {
            'data-toggle' : 'tooltip',
            'title':  'Cancel currently pending downloads.',
            'data-placement' : 'bottom',

            onclick : function () {cancelUploads.call(tb); }
        }, [
        m('i.fa.fa-times-circle'),
        m('span.hidden-xs', 'Cancel All Uploads')
    ]);
 }
 function deleteMultipleIcon (){
    var tb = this;
    return m('.fangorn-toolbar-icon.text-danger', {
            'data-toggle' : 'tooltip',
            'title':  'Delete all of the currently selected items.',
            'data-placement' : 'bottom',
            onclick : function (event) {
                    var configOption = resolveconfigOption.call(tb, tb.multiselected[0], 'removeEvent', [event, tb.multiselected]); // jshint ignore:line
                if(!configOption){ _removeEvent.call(tb, null, tb.multiselected); }

            }
        }, [
        m('i.fa.fa-trash'),
        m('span.hidden-xs', 'Delete Selected')
    ]);
 }

 function renameButton (){
    var tb = this;
    return m('#renameButton.fangorn-toolbar-icon.text-info', {
            'data-toggle' : 'tooltip',
            'title':  'Rename the currently selected file or folder',
            'data-placement' : 'bottom',
            onclick : function () {
                _renameEvent.call(tb);
            }
        }, [
        m('i.fa.fa-pencil'),
        m('span.hidden-xs', 'Rename')
    ]);
 }

 function createFolderButton (){
    var tb = this;
    return m('#createFolderButton.fangorn-toolbar-icon.text-success', {
            onclick : function (event) {
                _createFolder.call(tb, event, parent);
            }
        }, [
        m('i.fa.fa-plus'),
        m('span.hidden-xs', 'Create')
    ]);
 }

 function _renameEvent () {
    var tb = this;
    // var val = $.trim($('#renameInput').val());
    // if(tb.multiselected.length !== 1 || val.length < 1){
    //     tb.options.iconState.mode = 'bar';
    //     return;
    // }
    // var item = tb.multiselected[0];
    // var theItem = item.data;
    // //var url = needs url here
    // postAction = $osf.postJSON(url, postData);
    // postAction.done(function () {
    //     tb.updateFolder(null, tb.find(1));
    //     // Also update every
    // }).fail($osf.handleJSONError);
    // tb.options.iconState.mode = 'bar';
}


/**
 * When multiple rows are selected remove those that are not in the parent
 * @param {Array} rows List of item objects
 * @returns {Array} newRows Returns the revised list of rows
 */
function filterRowsNotInParent(rows) {
    if (this.multiselected.length < 2) {
        return this.multiselected;
    }
    var i, newRows = [],
        originalRow = this.find(this.multiselected[0].id),
        originalParent,
        currentItem;
    if (typeof originalRow !== "undefined") {
        originalParent = originalRow.parentID;
        for (i = 0; i < rows.length; i++) {
            currentItem = rows[i];
            if (currentItem.parentID === originalParent && currentItem.id !== -1) {
                newRows.push(rows[i]);
            } else {
                $('.tb-row[data-id="' + rows[i].id + '"]').stop().css('background-color', '#D18C93').animate({ backgroundColor: '#fff'}, 500, function() { $(this).css('background-color', ''); });
            }
        }
    }
    this.multiselected = newRows;
    this.highlightMultiselect();
    return newRows;
}


/**
 * Handles multiselect conditions and actions
 * @this Treebeard.controller
 * @param {Object} event jQuery click event.
 * @param {Object} row A Treebeard _item object.
 * @private
 */

 function _fangornMultiselect (event, row) {
    var tb = this;
    var selectedRows = filterRowsNotInParent.call(tb, tb.multiselected);
    _fangornResetToolbar.call(tb);

    if(tb.multiselected.length === 1){
        // empty row icons and assign row icons from item information
        tb.options.iconState.rowIcons = row.icons;
        // temporarily remove classes until mithril redraws raws with another hover.
        // $('.tb-row').removeClass('fangorn-selected');
        // $('.tb-row[data-id="' + row.id + '"]').removeClass(this.options.hoverClass).addClass('fangorn-selected');
        tb.select('#tb-tbody').removeClass('unselectable');
        tb.options.iconState.generalIcons.deleteMultiple.on = false;
    } else if (tb.multiselected.length > 1) {
        if(tb.multiselected[0].data.provider !== 'github') {
            tb.options.iconState.generalIcons.deleteMultiple.on = true;
        }
            tb.select('#tb-tbody').addClass('unselectable');
    }
    tb.redraw();
    if(tb.pressedKey === 'toggle') {
        tb.pressedKey = undefined;
    }
    reapplyTooltips();
}

/* MOVE */
// copyMode can be 'copy', 'move', 'forbidden', or null.
// This is set at draglogic and is used as global within this module
var copyMode = null;

// Set altkey global to fangorn
    var altKey = false;
    $(document).keydown(function (e) {
        if (e.altKey) {
            altKey = true;
        }
    });
    $(document).keyup(function (e) {
        if (!e.altKey) {
            altKey = false;
        }
    });

/**
 * Hook for the drag start event on jquery
 * @param event jQuery UI drggable event object
 * @param ui jQuery UI draggable ui object
 * @private
 */
function _fangornDragStart(event, ui) {
    var itemID = $(event.target).attr('data-id'),
        item = this.find(itemID);
    if (this.multiselected.length < 2) {
        this.multiselected = [item];
    }
}

/**
 * Hook for the drop event of jQuery UI droppable
 * @param event jQuery UI droppable event object
 * @param ui jQuery UI droppable ui object
 * @private
 */
function _fangornDrop(event, ui) {
    var tb = this;
    var items = tb.multiselected.length === 0 ? [tb.find(tb.selected)] : tb.multiselected,
        folder = tb.find($(event.target).attr('data-id'));

    // Run drop logic here
        _dropLogic.call(tb, event, items, folder);

}

/**
 * Hook for the over event of jQuery UI droppable
 * @param event jQuery UI droppable event object
 * @param ui jQuery UI droppable ui object
 * @private
 */
function _fangornOver(event, ui) {
    var tb = this;
    var items = tb.multiselected.length === 0 ? [tb.find(tb.selected)] : tb.multiselected,
        folder = tb.find($(event.target).attr('data-id')),
        dragState = _dragLogic.call(tb, event, items, ui);
    $('.tb-row').removeClass('tb-h-success fangorn-hover');
    if (dragState !== 'forbidden') {
        $('.tb-row[data-id="' + folder.id + '"]').addClass('tb-h-success');
    } else {
        $('.tb-row[data-id="' + folder.id + '"]').addClass('fangorn-hover');
    }
}

/**
 * Where the drop actions happen
 * @param event jQuery UI drop event
 * @param {Array} items List of items being dragged at the time. Each item is a _item object
 * @param {Object} folder Folder information as _item object
 */
function _dropLogic(event, items, folder) {
    var tb = this;
}

/**
 * Sets the copy state based on which item is being dragged on which other item
 * @param {Object} event Browser drag event
 * @param {Array} items List of items being dragged at the time. Each item is a _item object
 * @param {Object} ui jQuery UI draggable drag ui object
 * @returns {String} copyMode One of the copy states, from 'copy', 'move', 'forbidden'
 */
function _dragLogic(event, items, ui) {
    var tb = this;
        var canCopy = true,
        canMove = true,
        folder = this.find($(event.target).attr('data-id')),
        isSelf = false,
        isParent  = false,
        dragGhost = $('.tb-drag-ghost');
    items.forEach(function (item) {
        if (!isSelf) {
            isSelf = item.id === folder.id;
        }
        if(!isParent){
            isParent = item.parentID === folder.id;
        }
        canMove = canMove && item.data.permissions.edit;
    });
    if (folder.data.permissions.edit && folder.kind === 'folder' && folder.parentID !== 0 && canMove) {
        if (canMove) {
            if (altKey) {
                copyMode = 'copy';
            } else {
                copyMode = 'move';
            }
        }
    } else {
        copyMode = 'forbidden';
    }
    if (isSelf || isParent) {
        copyMode = 'forbidden';
    }
    // Set the cursor to match the appropriate copy mode
    switch (copyMode) {
        case 'forbidden':
            dragGhost.css('cursor', 'not-allowed');
            break;
        case 'copy':
            dragGhost.css('cursor', 'copy');
            break;
        case 'move':
            dragGhost.css('cursor', 'move');
            break;
        default:
            dragGhost.css('cursor', 'default');
    }
    return copyMode;

}
/* END MOVE */


function _resizeHeight () {
    var tb = this,
        windowHeight = $(window).height(),
        topBuffer = tb.select('#tb-tbody').offset().top + 50,
        availableSpace = windowHeight - topBuffer;
    if(availableSpace > 0) {
        tb.select('#tb-tbody').height(availableSpace);
    }

}

/**
 * OSF-specific Treebeard options common to all addons.
 * Check Treebeard API for more information
 */
tbOptions = {
    rowHeight : 30,         // user can override or get from .tb-row height
    showTotal : 15,         // Actually this is calculated with div height, not needed. NEEDS CHECKING
    paginate : false,       // Whether the applet starts with pagination or not.
    paginateToggle : false, // Show the buttons that allow users to switch between scroll and paginate.
    uploads : true,         // Turns dropzone on/off.
    columnTitles : _fangornColumnTitles,
    resolveRows : _fangornResolveRows,
    hoverClassMultiselect : 'fangorn-selected',
    multiselect : true,
    title : function() {

        // if(window.contextVars.diskSavingMode) {
        //     // If File and FileRead are not defined dropzone is not supported and neither is uploads
        //     if (window.File && window.FileReader) {
        //         return m('p', {
        //         }, [
        //             m('span', 'To Upload: Drag files into a folder OR click the '),
        //             m('i.btn.btn-default.btn-xs', { disabled : 'disabled'}, [ m('i.fa.fa-upload')]),
        //             m('span', ' below.')
        //         ]);
        //     }
        //     return m('p', {
        //         class: 'text-danger'
        //     }, [
        //         m('span', 'Your browser does not support file uploads, ', [
        //             m('a', { href: 'http://browsehappy.com' }, 'learn more'),
        //             '.'
        //         ])
        //     ]);
        // }
        return undefined;
    },
    showFilter : true,     // Gives the option to filter by showing the filter box.
    allowMove : false,       // Turn moving on or off.
    hoverClass : 'fangorn-hover',
    togglecheck : _fangornToggleCheck,
    sortButtonSelector : {
        up : 'i.fa.fa-chevron-up',
        down : 'i.fa.fa-chevron-down'
    },
    onload : function () {
        var tb = this;
        _loadTopLevelChildren.call(tb);
        $(document).on('click', '.fangorn-dismiss', function() {
            tb.redraw();
        });
        tb.select('#tb-tbody').on('click', function(event){
            if(event.target !== this) {
                return;
            }
            tb.clearMultiselect();
            _fangornResetToolbar.call(tb);
        })

        $(window).on('beforeunload', function() {
            if (tb.dropzone && tb.dropzone.getUploadingFiles().length) {
              return 'You have pending uploads, if you leave this page they may not complete.';
            }
        });
        if(tb.options.placement === 'project-files') {
            _resizeHeight.call(tb);
            $(window).resize(function(){
                _resizeHeight.call(tb);
            })
        }
        $(window).on('keydown', function(event){
            if (event.keyCode === 27) {
                _fangornResetToolbar.call(tb);
            }
        });
        $(document).on('keypress', '#createFolderInput', function () {
            if (tb.pressedKey === 13) {
                _createFolder.call(tb);
            }
        });
    },
    createcheck : function (item, parent) {
        return true;
    },
    deletecheck : function (item) {  // When user attempts to delete a row, allows for checking permissions etc.
        return true;
    },
    movecheck : function (to, from) { //This method gives the users an option to do checks and define their return
        return true;
    },
    movefail : function (to, from) { //This method gives the users an option to do checks and define their return
        return true;
    },
    addcheck : function (treebeard, item, file) {
        var size;
        var maxSize;
        var displaySize;
        var msgText;
        if (_fangornCanDrop(treebeard, item)) {
            if (item.data.accept && item.data.accept.maxSize) {
                size = file.size / 1000000;
                maxSize = item.data.accept.maxSize;
                if (size > maxSize) {
                    displaySize = Math.round(file.size / 10000) / 100;
                    msgText = 'One of the files is too large (' + displaySize + ' MB). Max file size is ' + item.data.accept.maxSize + ' MB.';
                    item.notify.update(msgText, 'warning', undefined, 3000);
                    return false;
                }
            }
            return true;
        }
        return false;
    },
    onscrollcomplete : function(){
        reapplyTooltips();
    },
    onmultiselect : _fangornMultiselect,
    filterPlaceholder : 'Search',
    onmouseoverrow : _fangornMouseOverRow,
    sortDepth : 2,
    dropzone : {                                           // All dropzone options.
        url: function(files) {return files[0].url;},
        clickable : '#treeGrid',
        addRemoveLinks: false,
        previewTemplate: '<div></div>',
        parallelUploads: 1,
        acceptDirectories: false,
        fallback: function(){}
    },
    resolveIcon : _fangornResolveIcon,
    resolveToggle : _fangornResolveToggle,
    // Pass ``null`` to avoid overwriting Dropzone URL resolver
    resolveUploadUrl: function() {return null;},
    resolveLazyloadUrl : _fangornResolveLazyLoad,
    resolveUploadMethod: _fangornUploadMethod,
    lazyLoadError : _fangornLazyLoadError,
    lazyLoadOnLoad : _fangornLazyLoadOnLoad,
    ontogglefolder : expandStateLoad,
    dropzoneEvents : {
        uploadprogress : _fangornUploadProgress,
        sending : _fangornSending,
        complete : _fangornComplete,
        success : _fangornDropzoneSuccess,
        error : _fangornDropzoneError,
        dragover : _fangornDragOver,
        addedfile : _fangornAddedFile,
        drop : _fangornDropzoneDrop
    },
    resolveRefreshIcon : function() {
        return m('i.fa.fa-refresh.fa-spin');
    },
    removeIcon : function(){
        return m.trust('&times;');
    },
    headerTemplate : _fangornToolbar,
    // Not treebeard options, specific to Fangorn
    iconState : _defaultIconState(),
    defineToolbar : _fangornDefineToolbar,
    onselectrow : function(row) {
        console.log(row);
    },
    // DRAG AND DROP RELATED OPTIONS
    dragOptions : {},
    dropOptions : {},
    dragEvents : {
        start : _fangornDragStart
    },
    dropEvents : {
        drop : _fangornDrop,
        over : _fangornOver
    },
    onafterselectwitharrow : function(row, direction) {
        var tb = this;
        var item = tb.find(row.id);
        _fangornMultiselect.call(tb,null,item);
    },
    hScroll : 400
};

/**
 * Loads Fangorn with options
 * @param {Object} options The options to be extended with Treebeard options
 * @constructor
 */
function Fangorn(options) {
    this.options = $.extend({}, tbOptions, options);
    this.grid = null;       // Set by _initGrid
    this.init();
}

/**
 * Initialize Fangorn methods that connect it to Treebeard
 * @type {{constructor: Fangorn, init: Function, _initGrid: Function}}
 */
Fangorn.prototype = {
    constructor: Fangorn,
    init: function () {
        this._initGrid();
    },
    // Create the Treebeard once all addons have been configured
    _initGrid: function () {
        this.grid = new Treebeard(this.options);
        return this.grid;
    },
    tests : {
        fangornToolbar : _fangornToolbar,
        defineToolbar : _fangornDefineToolbar
    }
};

Fangorn.ButtonEvents = {
    _downloadEvent: _downloadEvent,
    _uploadEvent: _uploadEvent,
    _removeEvent: _removeEvent,
    createFolder: _createFolder,
};

Fangorn.DefaultColumns = {
    _fangornTitleColumn: _fangornTitleColumn
};

Fangorn.Utils = {
    inheritFromParent: inheritFromParent,
    resolveconfigOption: resolveconfigOption,
    reapplyTooltips : reapplyTooltips,
    setCurrentFileID: setCurrentFileID,
    scrollToFile: scrollToFile,
    defineToolbar : _fangornDefineToolbar,
    resetToolbar : _fangornResetToolbar

};

Fangorn.DefaultOptions = tbOptions;

module.exports = Fangorn;
