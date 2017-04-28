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
 * Root Firebase reference that contains all the associated gui params
 */
const DEFAULT_ROOT_DB = "things/";

/**
 * dat.fire
 *
 * Connecting and updating dat.gui interfaces via Firebase Realtime Database
 *
 * @author Anthony Tripaldi @ Google Creative Lab
 */
export default class DatFire {

  /**
   * Create an instance of dat.fire, to connect dat.gui controllers and Firebase
   *
   * @param database initialized and configured instance of Firebase.database()
   * @param gui dat.GUI instance where you added all your controllers
   * @param params optional parameters for the firebase reference paths
   */
  constructor(database) {
    this.database = database

    this.controllers = []
    this.currentControllerIndex = -1;

    ([
      'handlePrev',
      'handleNext',
      'handleValueChange'
    ]).forEach((fn) => this[fn] = this[fn].bind(this))
  }

  initSimple(gui, params) {
    this.gui = gui
    this.params = params = Object.assign({}, DatFire.getDefaultParams(), params)

    if(this.gui.__controllers.length) {
      this.addControllers(gui.__controllers)
    }

    for (let folder in this.gui.__folders) {
      let controllers = this.gui.__folders[folder].__controllers
      if(controllers.length)
        this.addControllers(controllers)
    }

    this.database.ref(this.params.dbRef + this.params.prevRef)
      .on('value', this.handlePrev)

    this.database.ref(this.params.dbRef + this.params.nextRef)
      .on('value', this.handleNext)

    this.database.ref(this.params.dbRef + this.params.dialRef)
      .on('value', this.handleValueChange)

    this.handleNext(true)
  }

  initWithIndividualControllers(controllers, params) {
    this.addControllers(controllers)
    this.params = params = Object.assign({}, DatFire.getDefaultParams(), params)

    controllers.forEach((ctrl) => {
      this.database.ref(this.params.dbRef + ctrl.property)
        .on('value', this.handleValueChange)
    })
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
    // console.log("handleValueChange()", val.key)

    if (this.controllers.length && val != null) {
      this.currentController = this.getControllerByKey(val.key)
      const type = getControllerType(this.currentController)
      this[controllerMap[type]] && this[controllerMap[type]](val.val())
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
    controllers = Array.isArray(controllers) ? controllers : [controllers]
    let controllersWithKeys = []
    controllers.forEach((ctrl) => {
      controllersWithKeys.push({'key': ctrl.property, 'controller': ctrl})
    })

    this.controllers = this.controllers.concat(controllersWithKeys)
  }

  getControllerByKey(key) {
    for(let i = 0; i < this.controllers.length; i++) {
      if(this.controllers[i].key == key)
        return this.controllers[i].controller
    }
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
      dbRef: DEFAULT_ROOT_DB,
      nextRef: "next",
      prevRef: "prev",
      dialRef: "dial"
    }
  }

}
