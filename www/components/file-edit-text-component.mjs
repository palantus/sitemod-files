let elementName = "file-edit-text-component"

import api from "/system/api.mjs"
import "/components/richtext.mjs"
import Toast from "/components/toast.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <style>
    
  </style>
  <div id="container">
    <richtext-component id="editor" noclose></richtext-component>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById("editor").addEventListener("save", ({detail: {text}}) => this.save(text))

    this.fileId = this.getAttribute("file-id")
    this.federationId = this.getAttribute("federation-id")
  }

  async save(text){
    if(!this.fileId) return;
    let url = this.federationId ? `federation/${this.federationId}/api/file/${this.fileId}/content-text` : `file/${this.fileId}/content-text`
    await api.post(url, {content: this.shadowRoot.getElementById("editor").value()})
    new Toast({text: "Saved!"})
  }

  async loadFile(){
    if(!this.fileId) return;
    let url = this.federationId ? `federation/${this.federationId}/api/file/dl/${this.fileId}` : `file/dl/${this.fileId}`
    let res = await api.fetch(url)
    let text = await res.text()
    this.shadowRoot.getElementById("editor").value(text)
  }
    
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name){
      case "file-id":
        this.fileId = newValue;
        this.loadFile();
        break;
      case "federation-id":
        this.federationId = newValue;
        this.loadFile();
        break;
    }
  }

  static get observedAttributes() {
    return ["file-id", "federation-id"];
  } 

  connectedCallback() {
    this.loadFile();
  }

  disconnectedCallback() {
  }
}


window.customElements.define(elementName, Element);
export {Element, elementName as name}