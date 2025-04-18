import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// Todo 아이템 타입 정의
export type TodoItem = {
  id: string;
  content: string;
  roomNumber: string;
  guestName: string;
  peopleCount: number;
  status: 'new' | 'ing' | 'comp';
  createdAt: Date;
  handleBy?: string;
};

interface TodoProps {
  item: TodoItem;
  index: number;
  onStatusChange: (id: string, newStatus: 'new' | 'ing' | 'comp') => void;
  isEnabled?: boolean;
  currentUserName?: string;
}

export const Todo: React.FC<TodoProps> = ({ 
  item, 
  index, 
  onStatusChange, 
  isEnabled = true,
  currentUserName
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const TextWithColor = ({ style, children }: { style?: any, children: React.ReactNode }) => (
    <Text style={[{ color: colors.text }, style]}>{children}</Text>
  );

  // 날짜 포맷팅
  const formattedDate = () => {
    const date = item.createdAt instanceof Date 
      ? item.createdAt 
      : new Date(item.createdAt);
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const formattedHours = hours % 12 || 12;
    
    return `${ampm} ${formattedHours}:${minutes < 10 ? '0' + minutes : minutes}`;
  };

  // 다음 상태 결정 및 버튼 텍스트/색상 설정
  const getNextStatusInfo = () => {
    let nextStatus: 'new' | 'ing' | 'comp';
    let buttonText: string;
    let buttonColor: string;
    
    switch (item.status) {
      case 'new':
        nextStatus = 'ing';
        buttonText = '진행';
        buttonColor = '#4285F4';
        break;
      case 'ing':
        nextStatus = 'comp';
        buttonText = '완료';
        buttonColor = '#34A853';
        break;
      case 'comp':
      default:
        nextStatus = 'new';
        buttonText = '재요청';
        buttonColor = '#EA4335';
        break;
    }

    return { nextStatus, buttonText, buttonColor };
  };

  const { nextStatus, buttonText, buttonColor } = getNextStatusInfo();
  
  // 진행 상태이고 담당자가 다른 사람이면 버튼 비활성화
  const isButtonDisabled = () => {
    if (!isEnabled) return true;
    
    if (item.status === 'ing' && currentUserName && item.handleBy) {
      return item.handleBy !== currentUserName;
    }
    
    return false;
  };

  return (
    <View style={styles.todoItem}>
      <View style={styles.todoHeader}>
        <TextWithColor style={styles.todoOrder}>{index + 1}</TextWithColor>
        <TextWithColor style={styles.todoContent}>{item.content || ''}</TextWithColor>
        
        <View style={styles.todoHeaderRight}>
          {item.status === 'ing' && item.handleBy && (
            <TextWithColor style={styles.todoHandleBy}>담당: {item.handleBy}</TextWithColor>
          )}
          <TextWithColor style={styles.todoTime}>{formattedDate()}</TextWithColor>
        </View>
      </View>
      
      <View style={styles.todoBody}>
        <View style={styles.todoRow}>
          <TextWithColor style={styles.todoLabel}>객실:</TextWithColor>
          <TextWithColor style={styles.todoValue}>{item.roomNumber}호</TextWithColor>
        </View>
        
        <View style={styles.todoRow}>
          <TextWithColor style={styles.todoLabel}>이름:</TextWithColor>
          <TextWithColor style={styles.todoValue}>{item.guestName}</TextWithColor>
        </View>
        
        <View style={styles.todoRow}>
          <TextWithColor style={styles.todoLabel}>인원:</TextWithColor>
          <TextWithColor style={styles.todoValue}>{item.peopleCount}명</TextWithColor>
        </View>
      </View>
      
      <TouchableOpacity
        style={[
          styles.statusButton, 
          { backgroundColor: buttonColor },
          isButtonDisabled() && styles.disabledButton
        ]}
        onPress={() => onStatusChange(item.id, nextStatus)}
        disabled={isButtonDisabled()}
      >
        <Text style={styles.buttonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  todoItem: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  todoOrder: {
    fontWeight: 'bold',
    marginRight: 8,
    fontSize: 16,
  },
  todoContent: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  todoHeaderRight: {
    alignItems: 'flex-end',
  },
  todoTime: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  todoHandleBy: {
    fontSize: 12,
    color: '#a0a0a0',
    marginBottom: 2,
  },
  todoBody: {
    marginBottom: 10,
  },
  todoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  todoLabel: {
    width: 50,
    color: '#a0a0a0',
  },
  todoValue: {
    flex: 1,
  },
  statusButton: {
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default Todo; 