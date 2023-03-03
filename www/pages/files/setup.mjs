const elementName = 'files-setup-page'

import api from "/system/api.mjs"
import "/components/field-edit.mjs"
import "/components/field-list.mjs"
import {on, off} from "/system/events.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <style>
    #container{
        padding: 10px;
        position: relative;
    }
    field-list{
      width: 600px;
    }
  </style>  

  <div id="container">

    <h1>Files setup</h1>
    <field-list labels-pct="30">
      <field-edit type="checkbox" label="Only ASCII headers" id="onlyASCIIHeaders" title="Workaround for an issue on the Azure platform, where unicode characters cannot be present in content-disposition headers. Will be stripped of non-ASCII characters, if this is set"></field-edit>
    </field-list>
    <br>

  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);
    
    this.refreshData();
  }

  async refreshData(){

    let setup = await api.get("files/setup")

    this.shadowRoot.getElementById("onlyASCIIHeaders").setAttribute("value", !!setup.onlyASCIIHeaders)

    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `files/setup`));
  }

  connectedCallback() {
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}