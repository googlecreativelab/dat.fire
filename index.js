import objectAssign from 'object-assign'

Object.assign = Object.assign || objectAssign;

/**
 * Helper to figure out what type of dat.Controller we are modifying
 */
const getControllerType = (controller) => {
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

/**
 * A map of each controller type to its method handler name
 */
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
   * Create an instance of dat.fire.
   *
   * Once created, initialize it with either {@link #initSimple(gui, params)} or
   * {@link #initWithIndividualControllers(gui, controllers, params)}.
   *
   * @param database initialized and configured instance of Firebase.database()
   */
  constructor(database) {
    this.database = database

    this.controllers = []
    this.currentControllerIndex = -1;

    this.handleValueChange = this.handleValueChange.bind(this)
  }

  /**
   * Easiest way of using dat.fire. Just pass in your gui instance and set up a simple Firebase database.
   *
   * dat.fire will then assume that there are 3 inputs, previous, next, and value.
   *
   * In our Android Things example, we have two buttons for next and prev, and a dial that controls value. dat.fire
   * will then cycle through your dat.gui list on button press and change the value based on your dial usage.
   *
   * @param gui your completely initialized dat.gui instance
   * @param params optional parameters for using new reference names for the Firebase database connections.
   */
  initSimple(gui, params) {
    this.gui = gui
    this.addControllersFromGui()
    this.handleParams(params)

    this.handlePrev = this.handlePrev.bind(this)
    this.handleNext = this.handleNext.bind(this)

    this.database.ref(this.params.dbRef + this.params.prevRef)
      .on('value', this.handlePrev)

    this.database.ref(this.params.dbRef + this.params.nextRef)
      .on('value', this.handleNext)

    this.database.ref(this.params.dbRef + this.params.dialRef)
      .on('value', this.handleValueChange)

    this.handleNext(true)
  }

  initWithIndividualControllers(gui, controllers, params) {
    this.gui = gui
    this.addControllers(controllers)
    this.handleParams(params)

    controllers.forEach((ctrl) => {
      this.database.ref(this.params.dbRef + ctrl.property)
        .on('value', this.handleValueChange)
    })
  }

  addControllersFromGui() {
    if (this.gui.__controllers.length) {
      this.addControllers(this.gui.__controllers)
    }

    for (let folder in this.gui.__folders) {
      let controllers = this.gui.__folders[folder].__controllers
      if (controllers.length)
        this.addControllers(controllers)
    }
  }

  handleParams(params) {
    this.params = params = Object.assign({}, DatFire.getDefaultParams(), params)
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
    if(val != null) {
      console.log('handleColorControl()', val, this.currentController)
      // based on the code at https://github.com/dataarts/dat.gui/blob/master/src/dat/controllers/ColorController.js#L234
      // since setting value via setValue on its own doesn't do anything.
      // also need to explicitly set .s & .v since apparently, even in normal dat.gui, changing hue first doesn't
      // affect the color until you've clicked once on saturation field, so doing that here.
      // TODO(atripaldi) find best way to make this configurable per-controller without changing dat.gui
      this.currentController.__color.h = val * 360
      this.currentController.__color.s = 1
      this.currentController.__color.v = .5
      this.currentController.setValue(this.currentController.__color.toOriginal())
    }
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
      dialRef: "dial",
      simpleGui: false
    }
  }

}
