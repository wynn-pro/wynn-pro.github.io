from guizero import App, Text, TextBox, PushButton

def say_hello():
    greeting.value = "good morning, mr." + name_box.value + "!"

app = App(title="Greeter")

Text(app, text="What is your name?")
name_box = TextBox(app)
PushButton(app, text="Greet me", command=say_hello)
greeting = Text(app, text="", size=30)

app.display()
