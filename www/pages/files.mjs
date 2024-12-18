const elementName = 'files-page'

import api from "../system/api.mjs"
import { userPermissions, user } from "../system/user.mjs"
import "../components/action-bar.mjs"
import "../components/action-bar-item.mjs"
import "../components/field-ref.mjs"
import "../components/field.mjs"
import "../components/field-edit.mjs"
import "../components/acl.mjs"
import "../components/action-bar-menu.mjs"
import "../components/progress.mjs"
import { on, off, fire } from "../system/events.mjs"
import { state, apiURL, setPageTitle, goto, siteURL, stylesheets } from "../system/core.mjs"
import { showDialog } from "../components/dialog.mjs"
import { alertDialog } from "../components/dialog.mjs"
import { confirmDialog } from "../components/dialog.mjs"
import { toggleInRightbar } from "../pages/rightbar/rightbar.mjs"
import "../components/data/searchhelp.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <style>
    #container{
        position: relative;
    }
    .hidden{display: none;}
    table{
      width: 100%;
    }
    table thead tr{
      border-bottom: 1px solid gray;
    }
    img.iconbtn{width: 15px; cursor: pointer; margin-right: 2px;vertical-align: middle; filter: invert(1);}

    table tbody td:nth-child(1){width: 25px}
    table tbody td:nth-child(2){width: 450px}
    table tbody td:last-child{white-space: nowrap;}
    table tbody td{padding-top: 2px; padding-bottom: 1px;}
    table tbody tr{height: 28px;}

    table th:nth-child(2), table td:nth-child(2){padding-left: 0px;}
    h1{margin-top: 3px; margin-left: 5px; margin-bottom: 3px;}

    #files td.date{
      color: gray;
      width: 150px;
    }
    img.icon{max-height: 20px; max-width: 20px;}
    @media only screen and (max-width: 920px) {
      #files td.date{
        display: none;
      }
    }
    @media (hover: none) and (pointer: coarse) {
      table tbody td{padding-bottom: 5px; padding-top: 5px;}
    }
    #find-icon{height: 13px;}
    #options-menu button {margin-bottom: 5px;}
  </style>  

  <action-bar class="hidden">
      <action-bar-item id="search-btn" title="Search for files"><img id="find-icon" src="/img/find.png"></img></action-bar-item>
      <action-bar-item id="new-btn" class="hidden">Upload file(s)</action-bar-item>
      <action-bar-item id="add-folder" class="hidden">Add folder</action-bar-item>
      <action-bar-item id="create-symbolic-link-btn" class="hidden">Show in my files</action-bar-item>

      <action-bar-item id="options-menu" class="hidden">
        <action-bar-menu label="Options" width="120px">
          <button class="styled" id="download-folder" title="Only downloads the files that are currently shown. It does not allow download of folders.">Download all files</button><br>
          <button class="styled" id="delete-all-btn" class="hidden">Delete all</button><br>
          <button class="styled" id="copy-webdav-btn" class="hidden">Copy webdav link</button><br>
          <p>Order by:</p>
          <select id="order-by">
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
          </select>
          <select id="order-direction">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </action-bar-menu>
      </action-bar-item>

  </action-bar>

  <div id="container">   
    <h1 id="folder-name"></h1>

    <table>
        <tbody id="files">
        </tbody>
    </table>
  </div>

  <dialog-component title="Upload file" id="new-dialog">
    <field-component label="Tags"><input id="new-tag" placeholder="tag1, tag2, ..."></input></field-component>
    <input type="file" multiple>
    <br><br>
    <progress-bar complete-text="Upload complete!"></progress-bar>
  </dialog-component>
  
  <dialog-component title="Add folder" id="add-folder-dialog">
    <field-component label="Name"><input id="add-name"></input></field-component>
  </dialog-component>
  
  <dialog-component title="Add link" id="add-link-dialog">
    <p>A virtual folder will be created among your files. When opening it, the contents of this folder is shown. You can delete the link, without deleing this folder. The name doesn't have to be the same</p>
    <field-component label="Name"><input id="link-name"></input></field-component>
  </dialog-component>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' })
      .adoptedStyleSheets = [stylesheets.global, stylesheets.searchresults];
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.addFolder = this.addFolder.bind(this);
    this.downloadFolder = this.downloadFolder.bind(this);
    this.deleteAll = this.deleteAll.bind(this);
    this.tabClick = this.tabClick.bind(this)
    this.createSymbolicLink = this.createSymbolicLink.bind(this)

    this.shadowRoot.getElementById("search-btn").addEventListener("click", () => goto("/files-search"))
    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.uploadFile)
    this.shadowRoot.getElementById("add-folder").addEventListener("click", this.addFolder)
    this.shadowRoot.getElementById("download-folder").addEventListener("click", this.downloadFolder)
    this.shadowRoot.getElementById("delete-all-btn").addEventListener("click", this.deleteAll)
    this.shadowRoot.getElementById("create-symbolic-link-btn").addEventListener("click", this.createSymbolicLink)
    this.shadowRoot.getElementById("copy-webdav-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(`${siteURL()}/webdav/files${this.folderPath}`)
    })
    this.shadowRoot.getElementById("order-by").addEventListener("change", async () => {
      let val = this.shadowRoot.getElementById("order-by").value
      if (this.folder.options.orderBy == val) return;
      await api.patch(`file/${this.folder.id}`, {
        options: {
          orderBy: this.shadowRoot.getElementById("order-by").value,
        }
      });
      this.refreshData()
    })
    this.shadowRoot.getElementById("order-direction").addEventListener("change", async () => {
      let val = this.shadowRoot.getElementById("order-direction").value
      if (this.folder.options.orderDirection == val) return;
      await api.patch(`file/${this.folder.id}`, {
        options: {
          orderDirection: this.shadowRoot.getElementById("order-direction").value,
        }
      });
      this.refreshData()
    })
    this.shadowRoot.querySelector('table tbody').addEventListener("click", this.tabClick)

    if (state().path.startsWith("/folder/")) {
      this.folderId = state().path.substring(8)
      if (!isNaN(this.folderId)) this.folderId = parseInt(this.folderId)
      else this.folderId = null;
    } else {
      this.folderPath = state().path.substring(6)
      if (!this.folderPath.startsWith("/")) this.folderPath = "/" + this.folderPath
      this.folderPath = decodeURI(this.folderPath);
      if (this.folderPath == "/mine")
        this.folderPath = `/home/${user?.id}`
    }
  }
  async refreshData() {
    /*
    this.folder = this.folderId ? await api.get(`file/${encodeURI(this.folderId)}`)
                                : await api.get(`file/path${encodeURI(this.folderPath)}`)
    */
    this.folder = (await api.query(`{
        folder(${this.folderId ? `id: ${this.folderId}` : `path: "${this.folderPath}"`}){
          id, name, parentPath, owner{id}, rights, options {orderBy, orderDirection},
          content{
            ...on FileType{
              id, name, type, created, modified, tags, size
            },
            ...on FolderType{
              id, name, type, ${this.folderId ? '' : `parentPath, `}created, tags
            }
          }
        }
      }`)).folder
    if (!this.folder) return this.shadowRoot.querySelector('table tbody').innerHTML = ''
    this.shadowRoot.getElementById("folder-name").innerText = this.folder.parentPath == "/" && this.folder.name == "shared" ? "Shared files"
      : this.folder.parentPath == "/home" ? "My files"
        : !this.folder.parentPath && !this.folder.name ? "Root"
          : this.folder.name
    setPageTitle(!this.folder.parentPath ? "Files" : this.folder.name)
    this.shadowRoot.getElementById("order-by").value = this.folder.options.orderBy
    this.shadowRoot.getElementById("order-direction").value = this.folder.options.orderDirection
    this.shadowRoot.querySelector('table tbody').innerHTML = this.folder.content.sort((a, b) => {
      let dirFactor = this.folder.options.orderDirection == "asc" ? 1 : -1
      switch (this.folder.options.orderBy) {
        case "size":
          if (a.size == undefined) return -1 * dirFactor;
          if (b.size == undefined) return 1 * dirFactor;
          return (a.size == b.size ? 0 : a.size > b.size ? 1 : -1) * dirFactor;
        case "date":
          let aDate = a.modified || a.created
          let bDate = b.modified || b.created
          if (!aDate) return -1 * dirFactor;
          if (!bDate) return 1 * dirFactor;
          if (aDate < bDate) return -1 * dirFactor;
          if (aDate > bDate) return 1 * dirFactor;
          return 0;
        case "name":
        default:
          return (a.type == b.type ? (a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1) : a.type == "folder" ? -1 : 1) * dirFactor;
      }
    }).map(f => `
        <tr class="result ${f.type}" data-id="${f.id}" data-name="${f.name}">
          <td><img class="${f.type} icon" src="/img/${f.type == "folder" ? (f.isSymbolic ? "folder-link.png" : "folder.png") : "file-white.png"}"></td>
          <td><field-ref ref="${f.type == "folder" ? (this.folderId ? `/folder/${f.id}` : `/files${(f.parentPath && f.parentPath != "/") ? encodeURI(f.parentPath) : ""}/${encodeURI(f.name)}`) : `/file/${f.id}`}">${f.name}</field-ref></td>
          <td class="date">${(f.modified || f.created || "").replace("T", " ").substring(0, 19)}</td>
          <td>
            <img title="Show info" class="info iconbtn" src="/img/info.png">
            ${this.folder.rights.includes("w") ? `
              <img title="Edit" class="edit iconbtn${this.folder.rights.includes("w") ? '' : ' hidden'}" src="/img/edit.ico">
              <img title="Delete" class="delete iconbtn" src="/img/delete.png">
            `: ''}
          </td>
        </tr>
      `).join("");

    let permissions = await userPermissions()

    if (permissions.includes("file.upload") && this.folder.rights.includes("w")) {
      this.shadowRoot.getElementById("new-btn").classList.remove("hidden")
    }
    if (permissions.includes("file.edit") && this.folder.rights.includes("w")) {
      this.shadowRoot.getElementById("options-menu").classList.remove("hidden")
      this.shadowRoot.getElementById("add-folder").classList.remove("hidden")
      this.shadowRoot.getElementById("delete-all-btn").classList.remove("hidden")
      this.shadowRoot.getElementById("copy-webdav-btn").classList.remove("hidden")
    }
    if (permissions.includes("file.edit") && user?.id != "guest" && this.folder.owner?.id != user?.id) {
      this.shadowRoot.getElementById("create-symbolic-link-btn").classList.remove("hidden")
    }
    this.shadowRoot.querySelector("action-bar").classList.toggle("hidden", !!!this.shadowRoot.querySelector("action-bar action-bar-item:not(.hidden)"))
  }

  async uploadFile() {
    let dialog = this.shadowRoot.querySelector("#new-dialog")
    uploadNewFile(dialog, { folder: this.folder, tags: [], callback: this.refreshData })
  }

  addFolder() {
    if (this.shadowRoot.getElementById("add-folder").hasAttribute("disabled")) return;
    if (!this.folder) return;

    let dialog = this.shadowRoot.getElementById("add-folder-dialog")

    showDialog(dialog, {
      show: () => this.shadowRoot.getElementById("add-name").focus(),
      ok: async (val) => {
        await api.post(`file/${this.folder.id}/folders`, val)
        this.refreshData()
      },
      validate: (val) =>
        !val.name ? "Please fill out name"
          : true,
      values: () => {
        return {
          name: this.shadowRoot.getElementById("add-name").value
        }
      },
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  createSymbolicLink() {
    if (!this.folder) return;

    let dialog = this.shadowRoot.getElementById("add-link-dialog")
    this.shadowRoot.getElementById("link-name").value = this.folder.name

    showDialog(dialog, {
      show: () => this.shadowRoot.getElementById("link-name").focus(),
      ok: async (val) => {
        let homeFolder = await api.get(`file/path/home/${user.id}`)
        if (!homeFolder) return alertDialog("You do not have a home");
        await api.post(`file/${homeFolder.id}/folders`, val)
        this.refreshData()
      },
      validate: (val) =>
        !val.name ? "Please fill out name"
          : true,
      values: () => {
        return {
          name: this.shadowRoot.getElementById("link-name").value,
          linkTo: this.folder.id
        }
      },
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  async downloadFolder() {
    let suggestedName = this.folder?.name ? `${this.folder.name.replace(/[^a-zA-ZæøåÆØÅ0-9\-_.,*]/g, '_')}.zip` : "files.zip";
    if (typeof window.showSaveFilePicker === "undefined") {
      let { token } = await api.get("me/token")
      window.open(`${apiURL()}/file/query/dl?filter=folder:${this.folder.id}&token=${token}&name=${suggestedName}`)
      return;
    }

    const options = {
      suggestedName,
      types: [
        {
          description: 'Zip Files',
          accept: {
            'application/zip': ['.zip'],
          },
        },
      ],
    };

    let filePickerPromise = window.showSaveFilePicker(options);
    let file = await (await api.fetch(`file/query/dl?filter=folder:${this.folder.id}`)).blob()
    const newHandle = await filePickerPromise;
    const writableStream = await newHandle.createWritable();
    await writableStream.write(file);
    await writableStream.close();
  }

  async deleteAll() {
    if (!await confirmDialog(`Are you sure that you want to delete ALL files currently listed (filter "folder:${this.folder.id}")?`)) return;
    await api.del(`file/query?filter=folder:${this.folder.id}`)
    this.refreshData()
  }

  async tabClick(e) {
    if (e.target.tagName != "IMG") return;
    let tr = e.target.closest("tr");
    let id = tr.getAttribute("data-id")
    let name = tr.getAttribute("data-name")
    if (e.target.classList.contains("delete")) {
      if (!await confirmDialog(`Are you sure that you want to delete ${tr.classList.contains("folder") ? "folder" : "file"} ${name}?`)) return;
      await api.del(`file/${id}`)
      this.refreshData()
    } else if (e.target.classList.contains("edit")) {
      this.editRowClicked(e.target, tr, id)
    } else if (e.target.classList.contains("info")) {
      //goto(`/file/${id}`)
      toggleInRightbar("file-info", null, [["type", tr.classList.contains("file") ? "file" : "folder"], ["fileid", id]], true)
    }
  }

  editRowClicked(img, tr, id) {
    let tdName = tr.querySelector("td:nth-child(2)")
    let fileObj = this.folder.content.find(t => t.id == id)

    if (tr.hasAttribute("edit-mode")) {
      tr.removeAttribute("edit-mode")

      fileObj.name = tdName.querySelector("field-edit").getValue()
      tdName.innerHTML = `<field-ref ref="${fileObj.type == "folder" ? `/files${(fileObj.parentPath && fileObj.parentPath != "/") ? encodeURI(fileObj.parentPath) : ""}/${encodeURI(fileObj.name)}` : `/file/${fileObj.id}`}">${fileObj.name}</field-ref>`

      img.src = "/img/edit.ico"
    } else {
      tr.setAttribute("edit-mode", "true")

      tdName.innerHTML = `<field-edit type="text" value="${fileObj.name}" patch="file/${id}" field="name"></field-edit>`
      img.src = "/img/cancel.svg"
    }
  }

  connectedCallback() {
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

export async function uploadNewFile(dialog, { tags = [], folder = null, callback, acl = "" } = {}) {
  let progress = dialog.querySelector("progress-bar")
  progress.classList.toggle("hidden", true)
  let onProgress = value => progress.setAttribute("value", value)
  showDialog(dialog, {
    show: () => {
      dialog.querySelector("#new-tag").focus();
      dialog.querySelector("#new-tag").value = tags.join(", ");
    },
    ok: async (val) => {
      progress.classList.toggle("hidden", false)
      let formData = new FormData();
      for (let file of dialog.querySelector("input[type=file]").files)
        formData.append("file", file);
      let tags = val.tag.split(",").map(t => t.trim())
      let files;
      if (folder) {
        files = await api.upload(`file/folder/${folder.id}/upload?tags=${encodeURI(tags.join(","))}`, formData, { onProgress });
      } else {
        if (tags.length < 1) throw "Must provide a tag";
        files = await api.upload(`file/tag/${tags[0]}/upload?acl=${acl}`, formData, { onProgress });
      }
      if (tags.length > 1) {
        for (let f of files) {
          await api.patch(`file/${f.id}`, { tags })
        }
      }
      if (typeof callback === "function")
        callback(val);
    },
    validate: (val) =>
      !val.tag && !folder ? "Please fill out tag"
        : true,
    values: () => {
      return {
        tag: dialog.querySelector("#new-tag").value,
      }
    },
    close: () => {
      dialog.querySelectorAll("field-component input").forEach(e => e.value = '')
    }
  })
}

window.customElements.define(elementName, Element);
export { Element, elementName as name }
