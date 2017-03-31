import objectAssign from 'object-assign'

Object.assign = Object.assign || objectAssign;


//figure out what type of dat.Controller we are modifying
const getControllerType = (controller)=> {
  if (controller.__li.classList.contains('color')) {
    return 'color'
  } else {
    const type = typeof controller.getValue()
    if (type === 'number' || type === 'boolean') {
      return type
    } else {
      return 'option'
    }
  }
  return null
}

//map each controller type to its method handler name
const controllerMap = {
  'color': 'handleColorControl',
  'boolean': 'handleBooleanControl',
  'number': 'handleNumberControl',
  'option': 'handleOptionControl'
}

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
   * @param params optional parameters for the firebase reference paths
   */
  constructor(firebase, gui, params) {
    this.firebase = firebase
    this.gui = gui

    this.params = params = Object.assign({}, DemThings.getDefaultParams(), params)

    this.controllers = []
    this.currentControllerIndex = -1


    if(gui.__controllers.length) {
      this.addControllers(gui.__controllers)
    }

    for (let folder in gui.__folders) {
      let controllers = gui.__folders[folder].__controllers
      if(controllers.length)
        this.addControllers(controllers)
    }

    //bind `this` scope on these functions
    ([
      'handlePrev',
      'handleNext',
      'handleValueChange'
    ]).forEach((fn)=> this[fn] = this[fn].bind(this))

    const db = firebase.database()

    db.ref(params.dbRef + params.prevRef)
      .on('value', this.handlePrev)

    db.ref(params.dbRef + params.nextRef)
      .on('value', this.handleNext)

    db.ref(params.dbRef + params.dialRef)
      .on('value', this.handleValueChange)


    this.handleNext(true)
  }

  handlePrev(prev) {
    prev = prev.val ? prev.val() : prev
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
    next = next.val ? next.val() : next
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
    val = val.val ? val.val() : val
    if (this.controllers.length) {
      const type = getControllerType(this.currentController)
      this[controllerMap[type]] && this[controllerMap[type]](val);
    }
  }

  handleNumberControl(dialValue) {
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


  addControllers(controllers) {
    controllers = Array.isArray(controllers) || [controllers]
    this.controllers = this.controllers.concat(controllers)
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

  static getDefaultParams() {
    return {
      dbRef: "things/",
      nextRef: "next",
      prevRef: "prev",
      dialRef: "dial"
    }
  }

}
