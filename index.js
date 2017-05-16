import objectAssign from 'object-assign'

Object.assign = Object.assign || objectAssign

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
}

const map = (value, inMin, inMax, outMin, outMax) => {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin
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
const DEFAULT_ROOT_DB = "things/"

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
   * Once created, initialize it with {@link init(gui, controllers, params)}
   *
   * @param database initialized and configured instance of Firebase.database()
   */
  constructor(database) {
    this.database = database

    this.controllers = []
    this.currentControllerIndex = -1

    this.handleValueChange = this.handleValueChange.bind(this)
  }

  /**
   * Initialize dat.fire by connecting our controllers to Firebase database References.
   *
   * dat.fire has two primary ways of initializing. If no <code>controllers</code> parameter is passed, dat.fire will
   * automatically crab all controllers from the main <code>dat.GUI</code> object, checking all sub folders in the process.
   *
   * If you don't want to use every controller, pass an array of initialized dat.GUI.Controller's:
   * <code>
   *   // create controller somewhere
   *   var guiSpeed = simulatorGui.add(settings, 'speed', 0, 3);
   *   ...
   *
   *   // initialize with controllers
   *   datFire.init(gui, [guiSpeed, ...])
   * </code>
   * Both methods will then create Firebase reference value listeners for each Controller.property name, so the above example
   * will listen for a reference value change on "things/speed" since we also pre-pend a configurable root database ref.
   *
   * Additional parameters are available for simple controls. If you pass <code>{ "usePrevNext": true }</code> then
   * dat.fire won't add reference listeners for every controller, but rather assumes you only have 3 inputs, next, prev, and value.
   *
   * For example, with Android Things, you can set up two buttons and a dial, attach them to a Firebase Database at things/next,
   * things/prev, and things/value, and dat.fire will automatically scroll through all the possible controllers of your
   * dat.gui instance, controlling them via one slider or dial.
   *
   * If you pass <code>{ "simpleGui": true }</code> dat.fire will remove dat.gui from the screen entirely, only showing
   * the currently modified controller, ie, as you push a physical slider for speed, that will be the only controller onscreen.
   *
   * This is best for installations. Check out the example used at Google I/O at http://www.androidexperiments.com
   *
   * @param {dat.GUI} gui Initialized and completed dat.GUI instance. Only call this after you are finished adding controllers.
   * @param {Array} [controllers] Optional array of specific controllers to be added to dat.fire. If not present, we'll automatically add all controllers in our passed GUI instance.
   * @param {Object} [params]
   * @param {string} [params.dbRef] the top-level database ref in your Firebase schema.
   * @param {string} [params.nextRef] firebase ref for next button
   * @param {string} [params.prevRef] firebase ref for prev button
   * @param {string} [params.valueRef] firebase ref for dial or slider that will update the currently selected controller
   * @param {boolean} [params.usePrevNext] dat.fire will only expect to use a single dial with two buttons for iterating through an arbitrarily sized list of controllers
   * @param {boolean} [params.simpleGui] "Installation Mode" - whether or not we want to auto-hide dat.gui and only show items that are currently being updated.
   */
  init(gui, controllers, params) {
    this.gui = gui
    this.handleParams(params)

    if (controllers && Array.isArray(controllers)) {
      this.addControllers(controllers)
    } else {
      this.addAllControllersFromGui()
    }


    if (this.params.usePrevNext) {
      this.initPrevNext()
    } else {
      this.controllers.forEach((ctrlObj) => {
        this.database.ref(this.params.dbRef + ctrlObj.controller.property)
          .on('value', this.handleValueChange)
      })
    }
  }

  initPrevNext() {
    this.handlePrev = this.handlePrev.bind(this)
    this.handleNext = this.handleNext.bind(this)

    this.database.ref(this.params.dbRef + this.params.prevRef)
      .on('value', this.handlePrev)

    this.database.ref(this.params.dbRef + this.params.nextRef)
      .on('value', this.handleNext)

    this.database.ref(this.params.dbRef + this.params.valueRef)
      .on('value', this.handleValueChange)

    this.handleNext(true)
  }

  handleParams(params) {
    this.params = params = Object.assign({}, DatFire.getDefaultParams(), params)

    if(this.params.simpleGui) {
      this.setupSimpleGui();
    }
  }

  handlePrev(prev) {
    prev = prev.val ? prev.val() : prev
    if (prev) {
      this.currentControllerIndex--;

      if (this.currentControllerIndex < 0 ) {
        this.currentControllerIndex = this.controllers.length - 1;
      }

      if (this.currentController) {
        this.removeBackground(this.currentController.getParent())
      }

      this.currentController = this.controllers[this.currentControllerIndex]
      this.addBackground(this.currentController.getParent())
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
    if (this.controllers.length && val) {
      this.currentController = this.getControllerByKey(val.key)

      if(this.params.simpleGui) {
        this.currentController.show()
      }

      const type = getControllerType(this.currentController)
      this[controllerMap[type]] && this[controllerMap[type]](val.val())
    }
  }

  handleNumberControl(dialValue) {
    this.currentController.setValue(
      map(dialValue, 0, 1, this.currentController.__min, this.currentController.__max)
    )
  }

  handleBooleanControl(val) {
    if(val > .5)
      this.currentController.setValue(true)
    else
      this.currentController.setValue(false)
  }

  handleColorControl(val) {
    if(val) {
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
    this.currentController.__select.selectedIndex = Math.floor(val * this.currentController.__select.childNodes.length)
  }

  addAllControllersFromGui() {
    if (this.gui.__controllers.length) {
      this.addControllers(this.gui.__controllers)
    }

    for (let folder in this.gui.__folders) {
      let controllers = this.gui.__folders[folder].__controllers
      if (controllers.length)
        this.addControllers(controllers)
    }
  }

  addControllers(controllers) {
    let mappedControllers = []
    controllers.forEach((ctrl) => {
      if(this.params.simpleGui) {
        this.setFireTo(ctrl)
      }

      // easy parental access
      ctrl.getParent = () => ctrl.domElement.parentElement.parentElement

      mappedControllers.push({'key': ctrl.property, 'controller':ctrl})
    }, this)

    this.controllers = this.controllers.concat(mappedControllers)
  }

  /**
   * Adds additional simpleGui methods and properties to our controllers
   */
  setFireTo(controller) {
    controller.timeout = -1

    controller.hide = () => {
      this.fireList.removeChild(controller.getParent())

      controller.timeout = -1
    }

    controller.show = () => {
      this.fireList.appendChild(controller.getParent())

      if(controller.timeout !== -1) {
        clearTimeout(controller.timeout)
        controller.timeout = -1
      }
      controller.timeout = setTimeout(() => {controller.hide()}, 2000)
    }
  }

  getControllerByKey(key) {
    for(let i = 0; i < this.controllers.length; i++) {
      if(this.controllers[i].key === key)
        return this.controllers[i].controller
    }
  }

  removeBackground(parent) {
    parent.style.backgroundColor = ""
  }

  addBackground(parent) {
    parent.style.backgroundColor = "#555555"
  }

  setupSimpleGui() {
    this.gui.close()

    // create our new list for holding things
    this.fireList = document.createElement('ul')
    this.gui.domElement.appendChild(this.fireList)

    // get rid of close button
    this.gui.__closeButton.style.display = 'none'
  }

  static getDefaultParams() {
    return {
      dbRef: DEFAULT_ROOT_DB,
      nextRef: "next",
      prevRef: "prev",
      valueRef: "value",
      usePrevNext: false,
      simpleGui: false
    }
  }
}
