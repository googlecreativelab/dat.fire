/**
 * dem.things
 *
 * Connecting Android Things with dat.gui via Firebase Realtime Database
 *
 * @author Anthony Tripaldi @ Google Creative Lab
 */
export default class DemThings {

  /**
   * Create an instance of dem.things, to connect Android Things with dat.gui via Firebase
   *
   * @param firebase initialized and configured instance of Firebase
   * @param gui dat.GUI instance where you added all your controllers
   * @param controllerTypes HACK to make sure our type-checking matches the exact types being built,
   *        see {@link #initControllers} for more information.
   * @param params optional parameters for the firebase reference paths
   */
  constructor(firebase, gui, controllerTypes, params = null) {
    this.firebase = firebase
    this.gui = gui
    this.controllerTypes = controllerTypes

    this.params = params || this.getDefaultParams()

    this.controllers = []
    this.currentControllerIndex = -1

    this.initControllers()
    this.setupRefListener()

    this.handleNext(true)
  }

  setupRefListener() {
    this.firebase.database().ref(this.params.dbRef + this.params.prevRef)
      .on('value', (snapshot) => { this.handlePrev(snapshot.val()) })

    this.firebase.database().ref(this.params.dbRef + this.params.nextRef)
      .on('value', (snapshot) => { this.handleNext(snapshot.val()) })

    this.firebase.database().ref(this.params.dbRef + this.params.dialRef)
      .on('value', (snapshot) => { this.handleValueChange(snapshot.val()) })
  }

  handlePrev(prev) {
    if (prev) {
      this.currentControllerIndex--;

      if (this.currentControllerIndex < 0 ) {
        this.currentControllerIndex = this.controllers.length - 1;
      }

      if (this.currentController) {
        this.removeBackground(this.currentController)
      }

      this.currentController = this.controllers[this.currentControllerIndex]
      this.addBackground(this.currentController)
    }
  }

  handleNext(next) {
    if (next) {
      this.currentControllerIndex++;

      if (this.currentControllerIndex >= this.controllers.length) {
        this.currentControllerIndex = 0
      }

      if (this.currentController) {
        this.removeBackground(this.currentController)
      }

      this.currentController = this.controllers[this.currentControllerIndex]
      this.addBackground(this.currentController)
    }
  }

  handleValueChange(val) {
    if (this.controllers.length) {
      if(this.currentController instanceof this.controllerTypes.NumberControllerSlider) {
        this.handleNumberControlSlider(val)
      } else if(this.currentController instanceof this.controllerTypes.BooleanController) {
        this.handleBooleanControl(val)
      } else if(this.currentController instanceof this.controllerTypes.ColorController) {
        this.handleColorControl(val)
      } else if(this.currentController instanceof this.controllerTypes.OptionController) {
        this.handleOptionControl(val)
      }
    }
  }

  handleNumberControlSlider(dialValue) {
    let val = dialValue * (this.currentController.__max - this.currentController.__min)
    this.currentController.setValue(val)
  }

  handleBooleanControl(val) {
    if(val > .5)
      this.currentController.setValue(true)
    else
      this.currentController.setValue(false)
  }

  handleColorControl(val) {
    this.currentController.setValue(val * 0xFFFFFF)
  }

  handleOptionControl(val) {
    let index = Math.floor(val * this.currentController.__select.childNodes.length)
    this.currentController.__select.selectedIndex = index
  }

  initControllers() {
    if(this.gui.__controllers.length) {
      this.addControllers(this.gui.__controllers)
    }

    for (let folder in this.gui.__folders) {
      let controllers = this.gui.__folders[folder].__controllers
      if(controllers.length)
        this.addControllers(controllers)
    }
  }

  addControllers(controllers) {
    controllers.map((controller) => {
        this.controllers.push(controller)
    })
  }

  removeBackground(controller) {
    this.getParent(controller).style.backgroundColor = ""
  }

  addBackground(controller) {
    this.getParent(controller).style.backgroundColor = "#555555"
  }

  getParent(controller) {
    return controller.domElement.parentElement.parentElement
  }

  getDefaultParams() {
    return {
      dbRef: "things/",
      nextRef: "next",
      prevRef: "prev",
      dialRef: "dial"
    }
  }

}