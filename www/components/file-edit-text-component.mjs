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
  }

  async save(text){
    await api.postRaw(`file/${this.getAttribute("file-id")}/content`, this.shadowRoot.getElementById("editor").value(), "application/octet-stream")
    new Toast({text: "Saved!"})
  }

  async loadFile(){
    let res = await api.fetch(`file/dl/${this.getAttribute("file-id")}`)
    let text = await res.text()
    this.shadowRoot.getElementById("editor").value(text)
  }

  connectedCallback() {
    this.loadFile();
  }

  disconnectedCallback() {
  }
}


window.customElements.define(elementName, Element);
export {Element, elementName as name}