const elementName = 'inspect-ld-page'
import moment from "/libs/moment.js"
import LD2Reader from "/libs/ld2reader.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import api from "/system/api.mjs"
import {state, pushStateQuery, setPageTitle} from "/system/core.mjs"
import {on, off} from "/system/events.mjs"
import { alertDialog } from "/components/dialog.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <style>
    #container{
        padding: 5px;
        position: relative;
    }
    h1{
      margin-bottom: 5px;
    }
    #fileinput{
      padding-bottom: 5px;
      margin-top: 10px;
    }
    #hash{width: 250px;}
    
    /* Overview */
    
    #fileoverviewtab {
        border-collapse: collapse;
        width: 300px;
        border-top: 1px solid gray;
    }
    
    #fileoverviewtab th, #fileoverviewtab td {
        padding-left: 8px;
        padding-right: 8px;
        text-align: left;
        border-bottom: 1px solid gray;
        padding-top: 4px;
    }
    
    #fileoverviewtab td:last-child, #fileoverviewtab th:last-child{
      text-align: right;
    }
    
    #fileoverviewtab tr:hover{
      background-color: var(--table-hover);
    }
    
    #fileoverviewtab tbody tr{cursor: pointer;}
    
    #header{
      margin-top: 5px;
      margin-bottom: 5px;
    }
    
    /* Content */
    
    #tabcontent{
      display: none;
    }
    
    #curtabrecords, #curtabrecords td, #curtabrecords th {
        border: 1px solid #ddd;
        text-align: left;
    }
    
    #curtabrecords {
        border-collapse: collapse;
        width: 100%;
        margin-top: 10px;
        white-space: nowrap;
        font-size: 90%;
    }
    
    #curtabrecords th, #curtabrecords td {
        padding-left: 1px;
        padding-right: 1px;
    }
    
    #downloadFile{
      display:none;
    }
  
    .hidden{display: none;}
  </style>

  <div id="container">
    <h1>Inspect LD2 file</h1>
    <div id="controls">
      <label for="hash">Enter hash: </label>
      <input type="text" id="hash" placeholder="File hash"></input>
      <label for="fileinput"> or choose file: </label>
      <input type="file" id="fileinput" />
      <button id="downloadFile">Download</button>
    </div>
    <div id="header">
    </div>
    <table id="fileoverviewtab">
      <thead>
        <tr>
        <th>Table</th>
        <th>Records</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
    <div id="tabcontent">
      <button id="back">Back</button>
      <h3 id="curtabname"></h3>

      <button id="prev">Previous</button>
      <button id="next">Next</button>

      <table id="curtabrecords">
        <thead>
          <tr>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>

      <div>Showing records <span id="showfrom"></span> to <span id="showto"></span> of <span id="showtotal"></span></div>
    </div>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.readSingleFile = this.readSingleFile.bind(this)
    this.tableClicked = this.tableClicked.bind(this)

    this.reader = null;
    this.curTable = null;
    this.curOffset = 0;
    this.recordsPerPage = 20;

    this.shadowRoot.getElementById('fileinput').addEventListener('change', this.readSingleFile, false);
    this.shadowRoot.getElementById('back').addEventListener("click", () => {
      this.shadowRoot.getElementById('fileoverviewtab').style.display = "table"
      this.shadowRoot.getElementById('tabcontent').style.display = "none"
    })

    this.shadowRoot.getElementById('next').addEventListener("click", () => {
      let meta = this.reader.tables[this.curTable];
      if(this.curOffset + this.recordsPerPage < meta.recordCount){
        this.curOffset += this.recordsPerPage;
        this.showRecords()
      }
    })
    this.shadowRoot.getElementById('prev').addEventListener("click", () => {
      if(this.curOffset >= this.recordsPerPage){
        this.curOffset -= this.recordsPerPage;
        this.showRecords()
      }
    })

    this.shadowRoot.querySelector("#fileoverviewtab tbody").addEventListener("click", this.tableClicked)
    this.shadowRoot.getElementById('hash').addEventListener("change", () => {
      this.loadFileFromHash(this.shadowRoot.getElementById('hash').value)
    })
  }

  async attemptLoadParmFile(){
    let hash = state().query.hash || this.getAttribute("hash")
    if(hash){
      this.loadFileFromHash(hash)
    }
  }

  async loadFileFromHash(fileHash){
    if(!fileHash) return;
    this.shadowRoot.getElementById('downloadFile').style.display = "block"
    this.shadowRoot.getElementById('hash').value = fileHash
    if(!this.hasAttribute("hidecontrols")){
      pushStateQuery({hash: fileHash})
    }

    let fileMeta = await api.get(`file/${fileHash}`)
    let ext = fileMeta.name.split(".").pop();
    let response = await api.fetch(`file/download/${fileHash}`)
    let data = ext == "ld2" ? await response.blob() : await response.text();
    this.onFile({target: {result: data}}, fileMeta.name, "." + ext)

    this.shadowRoot.getElementById("downloadFile").addEventListener("click", () => window.open(fileMeta.links.download, '_blank'))
  }
  
  readSingleFile(evt) {
    //Retrieve the first (and only!) File from the FileList object
    var f = evt.target.files[0];

    if (f) {
      let ext = f.name.substring(f.name.lastIndexOf('.'))

      let r = new FileReader();
      r.onload = (e) => this.onFile(e, f.name, ext);

      pushStateQuery(undefined)
      this.shadowRoot.getElementById('hash').value = ''
      this.shadowRoot.getElementById('downloadFile').style.display = "none"

      switch(ext.toLowerCase()){
        case ".ld2":
            r.readAsArrayBuffer(f);
            break;
        case ".ld":
        case ".xpo":
            r.readAsText(f, 'ISO-8859-1');
            break;
        default:
          alertDialog(`Unknown file extension ${ext}`)
          return;
      }

    } else {
      alertDialog("Failed to load file");
    }
  }

  async onFile(e, filename, ext){
    let buffer = e.target.result;
    switch(ext.toLowerCase()){
      case ".ld2":
          this.reader = new LD2Reader(buffer);
          break;
      default:
        alertDialog(`Unknown file extension ${ext}`)
        return;
    }
  
    await this.reader.read();
  
    this.shadowRoot.querySelector("#fileoverviewtab tbody").innerHTML = '';
  
    this.shadowRoot.getElementById("header").innerText = `File format: ${this.reader.header.formatversion || "N/A"},
                       AX version: ${this.reader.header.axversion || "N/A"},
                       Exported at: ${/*moment.utc("1900-01-01").add(reader.header.date, "days").add(reader.header.time, "seconds").local().format("D. MMM YYYY HH:mm:ss")*/
                                      this.reader.header.date ? moment(this.reader.header.date + " " + this.reader.header.time).format("D. MMM YYYY HH:mm:ss") : "N/A"
                        }`
  
    let tables = this.reader.getTableNamesAsArray();
    for(let tableName of tables){
      let tab = this.reader.tables[tableName];
      let row = `<tr><td class="tabname">${tableName}</td><td>${tab.recordCount}</td></tr>`;
      //row.click(function(){tableClicked($(this).find(".tabname").text())})
      this.shadowRoot.querySelector("#fileoverviewtab tbody").innerHTML += row;
    }
  }

  async tableClicked(e){
    let tabName = e.target.closest("tr")?.querySelector(".tabname")?.innerText
    if(!tabName) return;
    this.shadowRoot.getElementById("fileoverviewtab").style.display = "none";
    this.shadowRoot.getElementById("tabcontent").style.display = "table";
    this.shadowRoot.getElementById("curtabname").innerText = tabName
    this.curTable = tabName;
    this.curOffset = 0;
    this.showRecords()
  }

  async showRecords(){
    this.shadowRoot.querySelector("#curtabrecords tbody").innerHTML = '';
    this.shadowRoot.querySelector("#curtabrecords thead tr").innerHTML = '';
  
    let records = await this.reader.getRecordsInRange(this.curTable, this.curOffset, this.recordsPerPage);
    let meta = this.reader.tables[this.curTable];
  
    for(let f of meta.fields){
      this.shadowRoot.querySelector("#curtabrecords thead tr").innerHTML += `<th>${f.name}</th>`
    }
  
    let tbody = this.shadowRoot.querySelector("#curtabrecords tbody");
    for(let r of records){
      let row = '';
      for(let f of meta.fields){
        let displayValue = moment.isMoment(r[f.name]) ? r[f.name].format(`D. MMM YYYY ${r[f.name].format('HH:mm:ss') == "00:00:00" ? "" : "HH:mm:ss"}`)
                         : (r[f.name] !== undefined && r[f.name] !== null)
                         ? (Array.isArray(r[f.name]) ? JSON.stringify(r[f.name]) : r[f.name])
                         : "";
        row += `<td>${displayValue}</td>`
      }
      tbody.innerHTML += `<tr>${row}</tr>`;
    }
  
    //Showing records <span id="showfrom"/> to <span id="showto"/> of <span id="showtotal"/>
  
    this.shadowRoot.getElementById("showfrom").innerText = this.curOffset + 1;
    this.shadowRoot.getElementById("showto").innerText = Math.min(meta.recordCount, this.curOffset + this.recordsPerPage);
    this.shadowRoot.getElementById("showtotal").innerText = meta.recordCount;
  }

  connectedCallback() {
    on("changed-page-query", elementName, (query) => this.loadFileFromHash(query.hash))
    this.attemptLoadParmFile();
    if(this.hasAttribute("hidecontrols")){
      this.shadowRoot.getElementById("controls").classList.toggle("hidden", true)
    }
    setPageTitle("Inspect LD2")
  }

  disconnectedCallback() {
    off("changed-page-query", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}