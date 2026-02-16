from collections import deque
from random import randint

test=int(input('Is this a test, type 1 if it is, 0 if it is not: '))

end=int(input('How long do you want the dumptruck simulation to run? [minutes]: '))



def p(curr):
    if(curr[0]=='e'):
        print('ending')
    elif(curr[0]=='s'):
        print('Finished weighing: ',curr[2])
    elif(curr[0]=='l'):
        print('Finished loading: ',curr[2])
    elif(curr[0]=='a'):
        print('Finished travelling: ',curr[2])
    else:
        print('init')

    print("time:",time,"loadQ:",list(loadQ),"loader:",loader,"weightQ:",list(weighQ),"scale:",scale,"fel:",list(fel)[::-1])
    print()
def insert(tup):
    for i in range(len(fel)):
        if(fel[i][1]<=tup[1]):
            fel.insert(i,tup)
            return
    fel.append(tup)

loadPick=[5,5,5,10,10,10,10,10,15,15]
weighPick=[12,12,12,12,12,12,12,16,16,16]
travelPick=[40,40,40,40,60,60,60,80,80,100]
def loadDist(x):
    if x:
        return loadA[x]
    else:
        return loadPick[randint(0,9)]

def weighDist(x):
    if x:
        return weighA[x]
    else:
        return weighPick[randint(0,9)]
def travelDist(x):
    if x:
        return travelA[x]
    else:
        return travelPick[randint(0,9)]
time=0

loadQ=deque()
loader=2
weighQ=deque()
scale=1

loadA=[0,10,5,5,10,15,10,10]
weighA=[0,12,12,12,16,12,16,12]
travelA=[0,60,100,40,40,80,60,40]

fel=deque()
fel.appendleft(('e',end,0))
fel.append(('s',weighDist(test*1),1))
fel.append(('l',loadDist(test*3),3))
fel.append(('l',loadDist(test*2),2))


loadQ.appendleft(4)
loadQ.appendleft(5)
loadQ.appendleft(6)

p(('i'))


while(fel):
    curr=fel.pop()
    time=curr[1]
    if(curr[0]=='e'):
        p(curr)
        break
    elif(curr[0]=='s'):
        insert(('a',time+travelDist(curr[2]*test),curr[2]))
        scale=0
        if(weighQ):
            new=weighQ.pop()
            insert(('s',time+weighDist(new*test),new))
            scale=1
        
    elif(curr[0]=='l'):
        loader-=1
        if(scale):
            weighQ.appendleft(curr[2])
        else:
            scale=1
            insert(('s',time+weighDist(curr[2]*test),curr[2]))
        if(loader<2 and loadQ):
            new=loadQ.pop()
            loader+=1
            insert(('l',time+loadDist(new*test),new))
    elif(curr[0]=='a'):
        if(loader>1):
            loadQ.appendleft(curr[2])
        else:
            loader+=1
            insert(('l',time+loadDist(curr[2]*test),curr[2]))
    p(curr)